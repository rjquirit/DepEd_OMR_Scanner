/**
 * ============================================================================
 * Production-Grade OMR Scanner Engine in C++ (OpenCV 4.x)
 * DepEd Region X Standardized 60-Item Answer Sheet (1467 x 2048 Canonical Space)
 * ============================================================================
 * 
 * Key Principles:
 * 1. Two-Zone Circular Measurement Model (Inner Core vs Outer Paper Ring)
 * 2. Relative Local Normalization (Immune to global lighting/shadows/pencil type)
 * 3. Perspective-Corrected Fixed Coordinate Mapping (No drifting darkest-pixel search)
 * 4. Question-Level Margin & Multiple-Mark Classification
 * 5. Diagnostic Visualization Image Output (GREEN/YELLOW/RED/GRAY overlays)
 *
 * Compilation:
 *   g++ -O3 -std=c++17 omr_scanner.cpp -o omr_scanner `pkg-config --cflags --libs opencv4`
 * 
 * Usage:
 *   ./omr_scanner "sample answered 60 item bubble sheet.png" [debug_output.png]
 */

#include <opencv2/opencv.hpp>
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <chrono>

// ============================================================================
// 1. CONFIGURATION & GEOMETRIC TEMPLATES
// ============================================================================

struct OMRConfig {
    // Bubble Radii
    double bubbleRadius = 11.0;
    double lrnBubbleRadius = 9.5;
    double innerRadiusRatio = 0.55;
    double ringInnerRatio = 0.72;

    // Feature Weights (Sum = 1.0)
    double contrastWeight = 0.45;
    double darkRatioWeight = 0.35;
    double percentileWeight = 0.20;

    // Adaptive Threshold Offsets
    double adaptiveOffsetMin = 18.0;
    double adaptiveOffsetRatio = 0.12;

    // Question-Level Decision Thresholds
    double minScore = 0.20;
    double minMargin = 0.10;
    double multipleScore = 0.20;
};

// Canonical Sheet Dimensions
const int REF_WIDTH = 1467;
const int REF_HEIGHT = 2048;

// 4 Corner Fiducial centers in Canonical Reference Coordinate Space
const cv::Point2f TARGET_TL(110.0f, 252.0f);
const cv::Point2f TARGET_TR(1355.0f, 252.0f);
const cv::Point2f TARGET_BR(1355.0f, 1928.0f);
const cv::Point2f TARGET_BL(110.0f, 1928.0f);

// 12-Digit Student LRN Coordinates
const std::vector<int> LRN_COLS_X = {322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760};
const std::vector<int> LRN_ROWS_Y = {428, 473, 518, 563, 608, 653, 697, 738, 783, 828};

// 60-Item Answer Section (3 Columns x 20 Questions)
struct QuestionColumn {
    int startQ;
    int endQ;
    int A, B, C, D;
};

const std::vector<QuestionColumn> QUESTION_COLUMNS = {
    {1, 20, 392, 436, 480, 524},
    {21, 40, 673, 717, 761, 807},
    {41, 60, 951, 997, 1041, 1087}
};

const std::vector<int> QUESTION_ROWS_Y = {
    947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386,
    1464, 1514, 1563, 1611, 1659, 1708, 1757, 1806, 1854, 1903
};

// ============================================================================
// 2. DATA STRUCTURES
// ============================================================================

struct BubbleMetric {
    int cx = 0;
    int cy = 0;
    double innerMean = 255.0;
    double ringMean = 255.0;
    double p20 = 255.0;
    double darkRatio = 0.0;
    double contrast = 0.0;
    double percentileDarkness = 0.0;
    double score = 0.0;
    bool filled = false;
};

struct QuestionClassification {
    int questionNumber = 0;
    char answer = '-'; // 'A', 'B', 'C', 'D', 'M' (multiple), '-' (blank)
    char bestOption = ' ';
    double bestScore = 0.0;
    char secondOption = ' ';
    double secondScore = 0.0;
    double margin = 0.0;
    double confidence = 0.0;
    bool isBlank = true;
    bool isMultiple = false;
    bool isAmbiguous = false;
    std::vector<std::pair<char, BubbleMetric>> options;
};

struct DigitClassification {
    char digitChar = '?';
    int digit = -1;
    double bestScore = 0.0;
    double secondScore = 0.0;
    double margin = 0.0;
    double confidence = 0.0;
    bool isBlank = true;
    bool isMultiple = false;
    std::vector<BubbleMetric> digitMetrics;
};

// ============================================================================
// 3. PERSPECTIVE CORRECTION & FIDUCIAL DETECTION
// ============================================================================

bool alignImageToCanonical(const cv::Mat& inputImg, cv::Mat& outputAligned) {
    cv::Mat gray;
    if (inputImg.channels() == 3) {
        cv::cvtColor(inputImg, gray, cv::COLOR_BGR2GRAY);
    } else {
        gray = inputImg.clone();
    }

    cv::Mat binary;
    cv::adaptiveThreshold(gray, binary, 255, cv::ADAPTIVE_THRESH_GAUSSIAN_C, cv::THRESH_BINARY_INV, 25, 10);

    std::vector<std::vector<cv::Point>> contours;
    cv::findContours(binary, contours, cv::RETR_EXTERNAL, cv::CHAIN_APPROX_SIMPLE);

    int imgW = gray.cols;
    int imgH = gray.rows;

    struct Candidate {
        cv::Point2f center;
        double area;
        double aspect;
    };

    std::vector<Candidate> candidates;
    for (const auto& cnt : contours) {
        cv::Rect r = cv::boundingRect(cnt);
        double minDim = std::min(imgW, imgH) * 0.012;
        double maxDim = std::min(imgW, imgH) * 0.050;

        if (r.width >= minDim && r.width <= maxDim && r.height >= minDim && r.height <= maxDim) {
            double aspect = (double)r.width / (double)r.height;
            if (aspect >= 0.75 && aspect <= 1.35) {
                cv::Moments m = cv::moments(cnt);
                if (m.m00 > 0) {
                    candidates.push_back({cv::Point2f(m.m10 / m.m00, m.m01 / m.m00), (double)r.area(), aspect});
                }
            }
        }
    }

    cv::Point2f foundTL(-1, -1), foundTR(-1, -1), foundBR(-1, -1), foundBL(-1, -1);
    for (const auto& c : candidates) {
        if (c.center.x < imgW * 0.35 && c.center.y < imgH * 0.35) foundTL = c.center;
        else if (c.center.x > imgW * 0.65 && c.center.y < imgH * 0.35) foundTR = c.center;
        else if (c.center.x > imgW * 0.65 && c.center.y > imgH * 0.65) foundBR = c.center;
        else if (c.center.x < imgW * 0.35 && c.center.y > imgH * 0.65) foundBL = c.center;
    }

    if (foundTL.x > 0 && foundTR.x > 0 && foundBR.x > 0 && foundBL.x > 0) {
        std::vector<cv::Point2f> srcQuad = {foundTL, foundTR, foundBR, foundBL};
        std::vector<cv::Point2f> dstQuad = {TARGET_TL, TARGET_TR, TARGET_BR, TARGET_BL};
        cv::Mat M = cv::getPerspectiveTransform(srcQuad, dstQuad);
        cv::warpPerspective(gray, outputAligned, M, cv::Size(REF_WIDTH, REF_HEIGHT), cv::INTER_CUBIC);
        return true;
    }

    cv::resize(gray, outputAligned, cv::Size(REF_WIDTH, REF_HEIGHT), 0, 0, cv::INTER_AREA);
    return false;
}

// ============================================================================
// 4. TWO-ZONE CIRCULAR MEASUREMENT MODEL
// ============================================================================

BubbleMetric analyzeBubble(
    const cv::Mat& gray,
    int cx,
    int cy,
    double radius,
    const OMRConfig& config = OMRConfig())
{
    const double innerRadius = radius * config.innerRadiusRatio;
    const double ringInnerRadius = radius * config.ringInnerRatio;
    const double ringOuterRadius = radius;

    const double innerRadiusSq = innerRadius * innerRadius;
    const double ringInnerRadiusSq = ringInnerRadius * ringInnerRadius;
    const double ringOuterRadiusSq = ringOuterRadius * ringOuterRadius;

    double innerSum = 0.0;
    double ringSum = 0.0;
    int ringCount = 0;

    std::vector<uchar> innerPixels;
    innerPixels.reserve(80);

    const int rInt = static_cast<int>(std::ceil(radius));

    for (int dy = -rInt; dy <= rInt; ++dy) {
        const int py = cy + dy;
        if (py < 0 || py >= gray.rows) continue;
        const int dySq = dy * dy;

        for (int dx = -rInt; dx <= rInt; ++dx) {
            const int px = cx + dx;
            if (px < 0 || px >= gray.cols) continue;

            const double distSq = static_cast<double>(dx * dx + dySq);
            const uchar val = gray.at<uchar>(py, px);

            // 1. Inner core: student shading zone
            if (distSq <= innerRadiusSq) {
                innerSum += val;
                innerPixels.push_back(val);
            }

            // 2. Outer ring: local paper background reflectance estimation
            if (distSq >= ringInnerRadiusSq && distSq <= ringOuterRadiusSq) {
                ringSum += val;
                ringCount++;
            }
        }
    }

    BubbleMetric result;
    result.cx = cx;
    result.cy = cy;

    const int innerCount = static_cast<int>(innerPixels.size());
    if (innerCount > 0) result.innerMean = innerSum / innerCount;
    if (ringCount > 0) result.ringMean = ringSum / ringCount;

    // 3. Calculate P20 (20th percentile) to capture light or partial pencil marks
    if (innerCount > 0) {
        std::sort(innerPixels.begin(), innerPixels.end());
        const size_t p20Idx = static_cast<size_t>(0.20 * (innerCount - 1));
        result.p20 = static_cast<double>(innerPixels[p20Idx]);
    }

    // 4. Relative Local Contrast: (Paper - Core) / Paper
    const double safeRingMean = std::max(1.0, result.ringMean);
    result.contrast = std::max(0.0, (result.ringMean - result.innerMean) / safeRingMean);

    // 5. Percentile Darkness: (Paper - P20) / Paper
    result.percentileDarkness = std::max(0.0, (result.ringMean - result.p20) / safeRingMean);

    // 6. Adaptive Dark Pixel Ratio
    const double adaptiveThreshold = result.ringMean - std::max(config.adaptiveOffsetMin, result.ringMean * config.adaptiveOffsetRatio);
    int darkCount = 0;
    for (uchar val : innerPixels) {
        if (static_cast<double>(val) < adaptiveThreshold) {
            darkCount++;
        }
    }
    result.darkRatio = innerCount > 0 ? (static_cast<double>(darkCount) / innerCount) : 0.0;

    // 7. Weighted Composite Bubble Score
    result.score =
        config.contrastWeight * result.contrast +
        config.darkRatioWeight * result.darkRatio +
        config.percentileWeight * result.percentileDarkness;

    result.filled = (result.score >= config.minScore);
    return result;
}

// ============================================================================
// 5. QUESTION-LEVEL CLASSIFIER
// ============================================================================

QuestionClassification classifyQuestion(
    const std::vector<std::pair<char, BubbleMetric>>& options,
    int qNum,
    const OMRConfig& config = OMRConfig())
{
    auto sorted = options;
    std::sort(sorted.begin(), sorted.end(), [](const auto& a, const auto& b) {
        return a.second.score > b.second.score;
    });

    const auto& first = sorted[0];
    const auto& second = sorted[1];

    QuestionClassification qc;
    qc.questionNumber = qNum;
    qc.bestOption = first.first;
    qc.bestScore = first.second.score;
    qc.secondOption = second.first;
    qc.secondScore = second.second.score;
    qc.margin = qc.bestScore - qc.secondScore;
    qc.options = options;

    if (qc.bestScore < config.minScore) {
        // Blank
        qc.isBlank = true;
        qc.answer = '-';
        qc.confidence = std::min(0.99, std::max(0.85, 1.0 - qc.bestScore));
    } else if (qc.secondScore >= config.multipleScore && qc.margin < config.minMargin) {
        // Multiple marks
        qc.isMultiple = true;
        qc.isAmbiguous = true;
        qc.answer = 'M';
        qc.confidence = std::max(0.50, std::min(0.90, 0.60 + (qc.secondScore - config.multipleScore)));
    } else if (qc.margin < config.minMargin) {
        // Ambiguous
        qc.isAmbiguous = true;
        qc.answer = 'M';
        qc.confidence = std::max(0.45, std::min(0.75, 0.50 + qc.margin));
    } else {
        // Single Winner
        qc.isBlank = false;
        qc.answer = first.first;
        const double normMargin = std::min(1.0, qc.margin / 0.5);
        const double normScore = std::min(1.0, qc.bestScore / 0.8);
        qc.confidence = std::min(0.99, std::max(0.70, 0.50 + 0.30 * normMargin + 0.20 * normScore));
    }

    return qc;
}

// ============================================================================
// 6. LRN DIGIT CLASSIFIER
// ============================================================================

DigitClassification classifyDigitColumn(
    const std::vector<BubbleMetric>& metrics,
    const OMRConfig& config = OMRConfig())
{
    struct IndexedScore { int digit; double score; };
    std::vector<IndexedScore> scores;
    for (int d = 0; d <= 9; ++d) {
        scores.push_back({d, metrics[d].score});
    }

    std::sort(scores.begin(), scores.end(), [](const auto& a, const auto& b) {
        return a.score > b.score;
    });

    const auto& top = scores[0];
    const auto& second = scores[1];

    DigitClassification dc;
    dc.bestScore = top.score;
    dc.secondScore = second.score;
    dc.margin = top.score - second.score;
    dc.digitMetrics = metrics;

    if (dc.bestScore < config.minScore) {
        dc.isBlank = true;
        dc.digitChar = '?';
        dc.confidence = std::min(0.99, std::max(0.85, 1.0 - dc.bestScore));
    } else if (dc.secondScore >= config.multipleScore && dc.margin < config.minMargin) {
        dc.isMultiple = true;
        dc.digitChar = '?';
        dc.confidence = std::max(0.50, std::min(0.85, 0.60 + (dc.secondScore - config.multipleScore)));
    } else if (dc.margin < config.minMargin) {
        dc.digitChar = '?';
        dc.confidence = std::max(0.45, std::min(0.75, 0.50 + dc.margin));
    } else {
        dc.isBlank = false;
        dc.digit = top.digit;
        dc.digitChar = static_cast<char>('0' + top.digit);
        const double normMargin = std::min(1.0, dc.margin / 0.5);
        const double normScore = std::min(1.0, dc.bestScore / 0.8);
        dc.confidence = std::min(0.99, std::max(0.70, 0.50 + 0.30 * normMargin + 0.20 * normScore));
    }

    return dc;
}

// ============================================================================
// 7. MAIN RUNTIME & DIAGNOSTIC VISUALIZATION
// ============================================================================

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cout << "Usage: " << argv[0] << " <image_path> [debug_output.png]" << std::endl;
        return 1;
    }

    std::string imagePath = argv[1];
    std::string debugOutputPath = (argc >= 3) ? argv[2] : "debug_omr_output.png";

    cv::Mat inputImage = cv::imread(imagePath);
    if (inputImage.empty()) {
        std::cerr << "Error: Could not load image: " << imagePath << std::endl;
        return 1;
    }

    auto startT = std::chrono::high_resolution_clock::now();
    OMRConfig config;

    // 1. Perspective Alignment
    cv::Mat alignedGray;
    bool aligned = alignImageToCanonical(inputImage, alignedGray);
    std::cout << "[OMR CV Engine] Loaded " << inputImage.cols << "x" << inputImage.rows
              << " | Alignment: " << (aligned ? "LOCKED (4-Fiducials)" : "RESIZED_FALLBACK") << std::endl;

    // Color image for debug overlay
    cv::Mat debugImg;
    cv::cvtColor(alignedGray, debugImg, cv::COLOR_GRAY2BGR);

    // 2. Evaluate 12-Digit LRN
    std::string extractedLRN = "";
    std::vector<DigitClassification> lrnResults;
    for (int col = 0; col < 12; ++col) {
        std::vector<BubbleMetric> digitMetrics;
        for (int row = 0; row <= 9; ++row) {
            BubbleMetric m = analyzeBubble(alignedGray, LRN_COLS_X[col], LRN_ROWS_Y[row], config.lrnBubbleRadius, config);
            digitMetrics.push_back(m);
        }
        DigitClassification dc = classifyDigitColumn(digitMetrics, config);
        lrnResults.push_back(dc);
        extractedLRN += dc.digitChar;

        // Draw LRN debug markings
        for (int row = 0; row <= 9; ++row) {
            cv::Point pt(LRN_COLS_X[col], LRN_ROWS_Y[row]);
            if (dc.digit == row) {
                // Green: Selected Digit
                cv::circle(debugImg, pt, static_cast<int>(config.lrnBubbleRadius), cv::Scalar(0, 200, 0), 2);
                cv::circle(debugImg, pt, static_cast<int>(config.lrnBubbleRadius * config.innerRadiusRatio), cv::Scalar(0, 160, 0), 1);
            } else if (digitMetrics[row].score >= config.minScore) {
                // Orange: Ambiguous candidate
                cv::circle(debugImg, pt, static_cast<int>(config.lrnBubbleRadius), cv::Scalar(0, 165, 255), 2);
            }
        }
    }

    std::cout << "\n==========================================" << std::endl;
    std::cout << ">>> EXTRACTED STUDENT LRN: " << extractedLRN << std::endl;
    std::cout << "==========================================\n" << std::endl;

    // 3. Evaluate 60 Items
    int answeredCount = 0;
    int blankCount = 0;
    int multipleCount = 0;
    std::vector<QuestionClassification> qResults;

    const std::vector<char> optLabels = {'A', 'B', 'C', 'D'};

    for (const auto& colGroup : QUESTION_COLUMNS) {
        for (int r = 0; r < 20; ++r) {
            int qNum = colGroup.startQ + r;
            int rowY = QUESTION_ROWS_Y[r];

            std::vector<int> optX = {colGroup.A, colGroup.B, colGroup.C, colGroup.D};
            std::vector<std::pair<char, BubbleMetric>> optMetrics;

            for (int o = 0; o < 4; ++o) {
                BubbleMetric m = analyzeBubble(alignedGray, optX[o], rowY, config.bubbleRadius, config);
                optMetrics.push_back({optLabels[o], m});
            }

            QuestionClassification qc = classifyQuestion(optMetrics, qNum, config);
            qResults.push_back(qc);

            if (qc.isBlank) blankCount++;
            else if (qc.isMultiple) multipleCount++;
            else answeredCount++;

            // Draw Question Debug circles & text
            for (int o = 0; o < 4; ++o) {
                cv::Point pt(optX[o], rowY);
                char optChar = optLabels[o];
                const auto& m = optMetrics[o].second;

                if (qc.answer == optChar) {
                    // Green: Accepted Answer
                    cv::circle(debugImg, pt, static_cast<int>(config.bubbleRadius), cv::Scalar(0, 200, 0), 2);
                    cv::circle(debugImg, pt, static_cast<int>(config.bubbleRadius * config.innerRadiusRatio), cv::Scalar(0, 160, 0), 1);
                } else if (qc.isMultiple && m.score >= config.multipleScore) {
                    // Red: Multiple Marks
                    cv::circle(debugImg, pt, static_cast<int>(config.bubbleRadius), cv::Scalar(0, 0, 255), 2);
                } else if (m.score >= config.minScore) {
                    // Orange: Ambiguous candidate
                    cv::circle(debugImg, pt, static_cast<int>(config.bubbleRadius), cv::Scalar(0, 165, 255), 2);
                } else {
                    // Gray: Empty bubble
                    cv::circle(debugImg, pt, static_cast<int>(config.bubbleRadius), cv::Scalar(180, 180, 180), 1);
                }
            }

            // Text Label
            std::string label = "Q" + std::to_string(qNum) + ": " + (qc.answer == '-' ? "BLANK" : (qc.answer == 'M' ? "MULTI" : std::string(1, qc.answer)));
            cv::Scalar textColor = qc.isBlank ? cv::Scalar(120, 120, 120) : (qc.isMultiple ? cv::Scalar(0, 0, 255) : cv::Scalar(0, 180, 0));
            cv::putText(debugImg, label, cv::Point(colGroup.A - 55, rowY + 4), cv::FONT_HERSHEY_SIMPLEX, 0.35, textColor, 1);
        }
    }

    // Print summary
    std::cout << "--- 60-ITEM ANSWERS OVERVIEW ---" << std::endl;
    for (const auto& qc : qResults) {
        std::cout << "Q" << std::setw(2) << std::setfill('0') << qc.questionNumber << ": "
                  << std::setw(6) << std::left << (qc.answer == '-' ? "BLANK" : (qc.answer == 'M' ? "MULTI" : std::string(1, qc.answer)))
                  << " (Best: " << qc.bestOption << "=" << std::fixed << std::setprecision(2) << qc.bestScore
                  << ", 2nd: " << qc.secondOption << "=" << qc.secondScore
                  << ", Margin: " << qc.margin
                  << ", Conf: " << std::setprecision(0) << (qc.confidence * 100.0) << "%)" << std::endl;
    }

    auto endT = std::chrono::high_resolution_clock::now();
    double timeMs = std::chrono::duration<double, std::milli>(endT - startT).count();

    std::cout << "\n==========================================" << std::endl;
    std::cout << "TOTAL ANSWERED: " << answeredCount << " / 60" << std::endl;
    std::cout << "BLANKS: " << blankCount << " | MULTIPLES: " << multipleCount << std::endl;
    std::cout << "PROCESSING TIME: " << std::fixed << std::setprecision(1) << timeMs << " ms" << std::endl;
    std::cout << "==========================================" << std::endl;

    // Save diagnostic debug image
    cv::imwrite(debugOutputPath, debugImg);
    std::cout << "[Diagnostic] Saved debug visualization to: " << debugOutputPath << std::endl;

    return 0;
}
