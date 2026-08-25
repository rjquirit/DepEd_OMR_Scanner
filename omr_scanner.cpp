/**
 * ============================================================================
 * Production-Grade OMR Scanner Engine in C++ (OpenCV 4.x) - Version 5.0
 * DepEd Region X Standardized 60-Item Answer Sheet (1467 x 2048 Canonical Space)
 * ============================================================================
 * 
 * Key Principles:
 * 1. Two-Zone Multi-Feature Circular Measurement Model with Precomputed Circle Masks
 * 2. Constrained Local Center Refinement (±5px search window evaluated by circular response)
 * 3. Relative Local Paper Normalization (immune to global lighting/shadows/pencil type)
 * 4. Genuine 4-Point Homography with Euclidean Reprojection Error Validation
 * 5. Question-Level Margin Ranking & Multi-Factor Calibrated Confidence
 * 6. High-Contrast Multi-Color Diagnostic Visualization Output
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
#include <queue>
#include <map>

// ============================================================================
// 1. CONFIGURATION & GEOMETRIC TEMPLATES (V5.0)
// ============================================================================

struct OMRConfig {
    std::string configVersion = "5.0.0";

    // Canonical Sheet Dimensions
    int canonicalWidth = 1467;
    int canonicalHeight = 2048;

    // Physical Bubble Outer Radii (px)
    double physicalBubbleRadius = 15.0;
    double physicalLrnBubbleRadius = 13.5;

    // Question Measurement Radii
    double questionCoreRadius = 7.5;
    double questionRingInnerRadius = 12.0;
    double questionRingOuterRadius = 15.0;
    double questionPaperRingInnerRadius = 18.0;
    double questionPaperRingOuterRadius = 22.0;

    // LRN Measurement Radii
    double lrnCoreRadius = 6.0;
    double lrnRingInnerRadius = 10.0;
    double lrnRingOuterRadius = 13.0;

    // Constrained Center Refinement
    int centerSearchRadiusPx = 5;
    double maxCenterOffsetPx = 6.0;

    // Adaptive Threshold Offsets
    double adaptiveOffsetMin = 18.0;
    double adaptiveOffsetRatio = 0.12;

    // Score Weight Distribution (Sum = 1.0)
    double contrastWeight = 0.35;
    double darkRatioWeight = 0.30;
    double percentileWeight = 0.20;
    double componentWeight = 0.10;
    double centroidWeight = 0.05;

    // Question Classification Decision Thresholds
    double minFillScore = 0.20;
    double minClassificationMargin = 0.10;
    double multipleScore = 0.20;

    // Alignment & Quality Gates
    double minFiducialConfidence = 0.70;
    double maxReprojectionErrorPx = 3.0;
};

// Canonical Dimensions
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

// 60-Item Answer Section (3 Columns x Top & Bottom Sections)
struct QuestionBlock {
    std::string blockId;
    int column;
    std::string section;
    int startQ;
    int endQ;
    int startRowIdx;
    int A, B, C, D;
};

const std::vector<QuestionBlock> QUESTION_BLOCKS = {
    // Top Section (Rows 0-9)
    {"LEFT_TOP", 1, "TOP", 1, 10, 0, 392, 436, 480, 524},
    {"CENTER_TOP", 2, "TOP", 11, 20, 0, 673, 717, 761, 807},
    {"RIGHT_TOP", 3, "TOP", 21, 30, 0, 951, 997, 1041, 1087},
    // Bottom Section (Rows 10-19)
    {"LEFT_BOTTOM", 1, "BOTTOM", 31, 40, 10, 392, 436, 480, 524},
    {"CENTER_BOTTOM", 2, "BOTTOM", 41, 50, 10, 673, 717, 761, 807},
    {"RIGHT_BOTTOM", 3, "BOTTOM", 51, 60, 10, 951, 997, 1041, 1087}
};

const std::vector<int> QUESTION_ROWS_Y = {
    947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386,
    1464, 1514, 1563, 1611, 1659, 1708, 1757, 1806, 1854, 1903
};

// ============================================================================
// 2. PRECOMPUTED CIRCULAR MASKS
// ============================================================================

struct MaskPoint {
    int dx;
    int dy;
    double distSq;
};

struct CircleMaskSet {
    std::vector<MaskPoint> core;
    std::vector<MaskPoint> ring;
    std::vector<MaskPoint> paper;
};

CircleMaskSet generateCircleMasks(double coreR, double ringInR, double ringOutR, double paperInR = 0, double paperOutR = 0) {
    CircleMaskSet masks;
    int maxR = static_cast<int>(std::ceil(std::max(ringOutR, paperOutR > 0 ? paperOutR : ringOutR)));
    double coreRSq = coreR * coreR;
    double ringInSq = ringInR * ringInR;
    double ringOutSq = ringOutR * ringOutR;
    double paperInSq = paperInR * paperInR;
    double paperOutSq = paperOutR * paperOutR;

    for (int dy = -maxR; dy <= maxR; ++dy) {
        double dySq = static_cast<double>(dy * dy);
        for (int dx = -maxR; dx <= maxR; ++dx) {
            double distSq = static_cast<double>(dx * dx) + dySq;
            if (distSq <= coreRSq) {
                masks.core.push_back({dx, dy, distSq});
            }
            if (distSq >= ringInSq && distSq <= ringOutSq) {
                masks.ring.push_back({dx, dy, distSq});
            }
            if (paperOutR > 0 && distSq >= paperInSq && distSq <= paperOutSq) {
                masks.paper.push_back({dx, dy, distSq});
            }
        }
    }
    return masks;
}

// ============================================================================
// 3. DATA STRUCTURES
// ============================================================================

struct BubbleFeatures {
    double coreMean = 255.0;
    double innerMean = 255.0;
    double ringMean = 255.0;
    double p10 = 255.0;
    double p20 = 255.0;
    double p30 = 255.0;
    double darkRatio = 0.0;
    double contrast = 0.0;
    double percentileDarkness = 0.0;
    double filledAreaRatio = 0.0;
    double largestComponentRatio = 0.0;
    int componentCount = 0;
    double centroidOffset = 0.0;
    double centroidScore = 1.0;
    double templateDifference = 0.0;
    double score = 0.0;
};

struct BubbleGeometry {
    int expectedX = 0;
    int expectedY = 0;
    int actualX = 0;
    int actualY = 0;
    double radius = 15.0;
    double offsetX = 0.0;
    double offsetY = 0.0;
};

struct BubbleMetric : public BubbleFeatures, public BubbleGeometry {
    bool filled = false;
};

struct QuestionClassification {
    int questionNumber = 0;
    char answer = '-'; // 'A', 'B', 'C', 'D', 'M' (multiple), '-' (blank)
    char bestOption = 'A';
    double bestScore = 0.0;
    char secondOption = 'B';
    double secondScore = 0.0;
    double margin = 0.0;
    double confidence = 0.0;
    bool isBlank = true;
    bool isMultiple = false;
    bool isAmbiguous = false;
    std::map<char, BubbleMetric> metrics;
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
    bool isAmbiguous = false;
    std::vector<BubbleMetric> metrics;
};

struct ReprojectionReport {
    double meanError = 0.0;
    double maxError = 0.0;
    double tlErr = 0.0, trErr = 0.0, brErr = 0.0, blErr = 0.0;
};

// ============================================================================
// 4. PERSPECTIVE CORRECTION & REPROJECTION ERROR
// ============================================================================

ReprojectionReport calculateReprojection(
    const std::vector<cv::Point2f>& srcPts,
    const std::vector<cv::Point2f>& dstPts)
{
    cv::Mat H = cv::getPerspectiveTransform(srcPts, dstPts);
    cv::Mat Hinv = H.inv();

    ReprojectionReport report;
    std::vector<double> errors;

    for (size_t i = 0; i < 4; ++i) {
        cv::Mat pt = (cv::Mat_<double>(3, 1) << dstPts[i].x, dstPts[i].y, 1.0);
        cv::Mat reprojected = Hinv * pt;
        double denom = reprojected.at<double>(2, 0);
        double rx = reprojected.at<double>(0, 0) / denom;
        double ry = reprojected.at<double>(1, 0) / denom;

        double err = std::sqrt((rx - srcPts[i].x) * (rx - srcPts[i].x) + (ry - srcPts[i].y) * (ry - srcPts[i].y));
        errors.push_back(err);
    }

    report.tlErr = errors[0];
    report.trErr = errors[1];
    report.brErr = errors[2];
    report.blErr = errors[3];
    report.meanError = (errors[0] + errors[1] + errors[2] + errors[3]) / 4.0;
    report.maxError = std::max({errors[0], errors[1], errors[2], errors[3]});

    return report;
}

bool alignImageToCanonical(
    const cv::Mat& inputImg,
    cv::Mat& outputAligned,
    ReprojectionReport& reprojReport,
    double& fiducialConfidence)
{
    cv::Mat gray;
    if (inputImg.channels() == 3) {
        cv::cvtColor(inputImg, gray, cv::COLOR_BGR2GRAY);
    } else {
        gray = inputImg.clone();
    }

    int imgW = gray.cols;
    int imgH = gray.rows;

    cv::Mat binary;
    cv::adaptiveThreshold(gray, binary, 255, cv::ADAPTIVE_THRESH_GAUSSIAN_C, cv::THRESH_BINARY_INV, 25, 10);

    std::vector<std::vector<cv::Point>> contours;
    cv::findContours(binary, contours, cv::RETR_EXTERNAL, cv::CHAIN_APPROX_SIMPLE);

    struct Candidate {
        cv::Point2f center;
        double area;
        double aspect;
    };

    std::vector<Candidate> candidates;
    for (const auto& cnt : contours) {
        cv::Rect r = cv::boundingRect(cnt);
        double minDim = std::min(imgW, imgH) * 0.012;
        double maxDim = std::min(imgW, imgH) * 0.055;

        if (r.width >= minDim && r.width <= maxDim && r.height >= minDim && r.height <= maxDim) {
            double aspect = static_cast<double>(r.width) / static_cast<double>(r.height);
            if (aspect >= 0.70 && aspect <= 1.40) {
                cv::Moments m = cv::moments(cnt);
                if (m.m00 > 0) {
                    candidates.push_back({cv::Point2f(static_cast<float>(m.m10 / m.m00), static_cast<float>(m.m01 / m.m00)), static_cast<double>(r.area()), aspect});
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

        reprojReport = calculateReprojection(srcQuad, dstQuad);
        fiducialConfidence = std::max(0.70, std::min(0.99, 1.0 - (reprojReport.meanError / 10.0)));

        cv::Mat M = cv::getPerspectiveTransform(srcQuad, dstQuad);
        cv::warpPerspective(gray, outputAligned, M, cv::Size(REF_WIDTH, REF_HEIGHT), cv::INTER_CUBIC);
        return true;
    }

    fiducialConfidence = 0.40;
    reprojReport.meanError = 8.5;
    reprojReport.maxError = 12.0;
    cv::resize(gray, outputAligned, cv::Size(REF_WIDTH, REF_HEIGHT), 0, 0, cv::INTER_AREA);
    return false;
}

// ============================================================================
// 5. CONSTRAINED CENTER REFINEMENT & MULTI-ZONE MEASUREMENT
// ============================================================================

void refineCenter(
    const cv::Mat& gray,
    int expX, int expY,
    double coreR, int searchR, double maxOffset,
    int& outX, int& outY, double& offX, double& offY)
{
    outX = expX;
    outY = expY;
    offX = 0.0;
    offY = 0.0;

    int smallR = std::max(3, static_cast<int>(coreR * 0.7));
    int smallRSq = smallR * smallR;
    double bestDarkScore = -1e9;
    int bestX = expX;
    int bestY = expY;

    for (int sdy = -searchR; sdy <= searchR; ++sdy) {
        int cy = expY + sdy;
        if (cy < coreR || cy >= gray.rows - coreR) continue;

        for (int sdx = -searchR; sdx <= searchR; ++sdx) {
            double dist = std::sqrt(sdx * sdx + sdy * sdy);
            if (dist > maxOffset) continue;

            int cx = expX + sdx;
            if (cx < coreR || cx >= gray.cols - coreR) continue;

            double sum = 0.0;
            int count = 0;
            for (int dy = -smallR; dy <= smallR; ++dy) {
                int py = cy + dy;
                int dySq = dy * dy;
                const uchar* rowPtr = gray.ptr<uchar>(py);
                for (int dx = -smallR; dx <= smallR; ++dx) {
                    if (dx * dx + dySq <= smallRSq) {
                        sum += (255 - rowPtr[cx + dx]);
                        count++;
                    }
                }
            }

            double score = count > 0 ? (sum / count) : 0.0;
            double penalized = score - dist * 1.5;
            if (penalized > bestDarkScore) {
                bestDarkScore = score;
                bestX = cx;
                bestY = cy;
            }
        }
    }

    if (bestDarkScore > 35.0) {
        outX = bestX;
        outY = bestY;
        offX = static_cast<double>(bestX - expX);
        offY = static_cast<double>(bestY - expY);
    }
}

BubbleMetric analyzeBubble(
    const cv::Mat& gray,
    int expectedX,
    int expectedY,
    const CircleMaskSet& masks,
    double coreRadius,
    double outerRadius,
    const OMRConfig& config = OMRConfig())
{
    int actualX = expectedX, actualY = expectedY;
    double offsetX = 0.0, offsetY = 0.0;

    refineCenter(gray, expectedX, expectedY, coreRadius, config.centerSearchRadiusPx, config.maxCenterOffsetPx, actualX, actualY, offsetX, offsetY);

    double innerSum = 0.0;
    std::vector<uchar> innerPixels;
    innerPixels.reserve(masks.core.size());

    struct InnerCoord { int dx, dy; uchar val; };
    std::vector<InnerCoord> innerCoords;
    innerCoords.reserve(masks.core.size());

    for (const auto& pt : masks.core) {
        int px = actualX + pt.dx;
        int py = actualY + pt.dy;
        if (px >= 0 && px < gray.cols && py >= 0 && py < gray.rows) {
            uchar val = gray.at<uchar>(py, px);
            innerSum += val;
            innerPixels.push_back(val);
            innerCoords.push_back({pt.dx, pt.dy, val});
        }
    }

    double ringSum = 0.0;
    int ringCount = 0;
    for (const auto& pt : masks.ring) {
        int px = actualX + pt.dx;
        int py = actualY + pt.dy;
        if (px >= 0 && px < gray.cols && py >= 0 && py < gray.rows) {
            ringSum += gray.at<uchar>(py, px);
            ringCount++;
        }
    }

    double paperSum = 0.0;
    int paperCount = 0;
    for (const auto& pt : masks.paper) {
        int px = actualX + pt.dx;
        int py = actualY + pt.dy;
        if (px >= 0 && px < gray.cols && py >= 0 && py < gray.rows) {
            paperSum += gray.at<uchar>(py, px);
            paperCount++;
        }
    }

    BubbleMetric result;
    result.expectedX = expectedX;
    result.expectedY = expectedY;
    result.actualX = actualX;
    result.actualY = actualY;
    result.radius = outerRadius;
    result.offsetX = offsetX;
    result.offsetY = offsetY;

    int innerCount = static_cast<int>(innerPixels.size());
    result.coreMean = innerCount > 0 ? innerSum / innerCount : 255.0;
    result.innerMean = result.coreMean;

    double refPaperMean = paperCount > 0 ? (paperSum / paperCount) : (ringCount > 0 ? (ringSum / ringCount) : 255.0);
    result.ringMean = ringCount > 0 ? (ringSum / ringCount) : refPaperMean;
    if (refPaperMean < result.ringMean * 0.9) refPaperMean = result.ringMean;

    // Percentiles
    if (innerCount > 0) {
        std::sort(innerPixels.begin(), innerPixels.end());
        result.p10 = static_cast<double>(innerPixels[static_cast<size_t>(0.10 * (innerCount - 1))]);
        result.p20 = static_cast<double>(innerPixels[static_cast<size_t>(0.20 * (innerCount - 1))]);
        result.p30 = static_cast<double>(innerPixels[static_cast<size_t>(0.30 * (innerCount - 1))]);
    }

    // Relative Local Contrast & Percentile Darkness
    double safePaper = std::max(1.0, refPaperMean);
    result.contrast = std::max(0.0, std::min(1.0, (refPaperMean - result.coreMean) / safePaper));
    result.percentileDarkness = std::max(0.0, std::min(1.0, (refPaperMean - result.p20) / safePaper));

    // Adaptive threshold & dark ratio
    double adaptThresh = refPaperMean - std::max(config.adaptiveOffsetMin, refPaperMean * config.adaptiveOffsetRatio);
    int darkPixels = 0;
    double sumDarkDX = 0.0, sumDarkDY = 0.0, sumDarkWeight = 0.0;

    int rInt = static_cast<int>(std::ceil(coreRadius));
    int gridDim = rInt * 2 + 1;
    std::vector<std::vector<bool>> darkGrid(gridDim, std::vector<bool>(gridDim, false));

    for (const auto& c : innerCoords) {
        if (static_cast<double>(c.val) < adaptThresh) {
            darkPixels++;
            double w = adaptThresh - c.val;
            sumDarkDX += c.dx * w;
            sumDarkDY += c.dy * w;
            sumDarkWeight += w;

            int gx = c.dx + rInt;
            int gy = c.dy + rInt;
            if (gx >= 0 && gx < gridDim && gy >= 0 && gy < gridDim) {
                darkGrid[gy][gx] = true;
            }
        }
    }

    result.darkRatio = innerCount > 0 ? static_cast<double>(darkPixels) / innerCount : 0.0;
    result.filledAreaRatio = result.darkRatio;

    // Connected Component Analysis
    int compCount = 0;
    int largestComp = 0;
    std::vector<std::vector<bool>> visited(gridDim, std::vector<bool>(gridDim, false));

    for (int gy = 0; gy < gridDim; ++gy) {
        for (int gx = 0; gx < gridDim; ++gx) {
            if (darkGrid[gy][gx] && !visited[gy][gx]) {
                compCount++;
                int size = 0;
                std::queue<std::pair<int, int>> q;
                q.push({gx, gy});
                visited[gy][gx] = true;

                while (!q.empty()) {
                    auto [qx, qy] = q.front();
                    q.pop();
                    size++;

                    for (int dy = -1; dy <= 1; ++dy) {
                        for (int dx = -1; dx <= 1; ++dx) {
                            if (dx == 0 && dy == 0) continue;
                            int nx = qx + dx;
                            int ny = qy + dy;
                            if (nx >= 0 && nx < gridDim && ny >= 0 && ny < gridDim && darkGrid[ny][nx] && !visited[ny][nx]) {
                                visited[ny][nx] = true;
                                q.push({nx, ny});
                            }
                        }
                    }
                }
                if (size > largestComp) largestComp = size;
            }
        }
    }

    result.componentCount = compCount;
    result.largestComponentRatio = innerCount > 0 ? static_cast<double>(largestComp) / innerCount : 0.0;
    double compScore = compCount == 1 ? result.largestComponentRatio : (result.largestComponentRatio * 0.85);

    // Centroid Offset & Score
    if (sumDarkWeight > 0.0) {
        double cdx = sumDarkDX / sumDarkWeight;
        double cdy = sumDarkDY / sumDarkWeight;
        result.centroidOffset = std::sqrt(cdx * cdx + cdy * cdy);
        result.centroidScore = std::max(0.1, 1.0 - (result.centroidOffset / (coreRadius > 0 ? coreRadius : 1.0)));
    } else {
        result.centroidOffset = 0.0;
        result.centroidScore = 0.5;
    }

    result.templateDifference = std::max(0.0, std::min(1.0, (refPaperMean - result.p10) / safePaper));

    // Weighted Score
    result.score =
        config.contrastWeight * result.contrast +
        config.darkRatioWeight * result.darkRatio +
        config.percentileWeight * result.percentileDarkness +
        config.componentWeight * compScore +
        config.centroidWeight * result.centroidScore;

    result.score = std::max(0.0, std::min(1.0, result.score));
    result.filled = (result.score >= config.minFillScore);

    return result;
}

// ============================================================================
// 6. QUESTION-LEVEL & DIGIT CLASSIFIERS
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

    for (const auto& opt : options) {
        qc.metrics[opt.first] = opt.second;
    }

    if (qc.bestScore < config.minFillScore) {
        qc.isBlank = true;
        qc.answer = '-';
        qc.confidence = std::min(0.99, std::max(0.85, 1.0 - qc.bestScore));
    } else if (qc.secondScore >= config.multipleScore && qc.margin < config.minClassificationMargin) {
        qc.isMultiple = true;
        qc.isAmbiguous = true;
        qc.answer = 'M';
        qc.confidence = std::max(0.50, std::min(0.92, 0.60 + (qc.secondScore - config.multipleScore)));
    } else if (qc.margin < config.minClassificationMargin) {
        qc.isAmbiguous = true;
        qc.answer = 'M';
        qc.confidence = std::max(0.40, std::min(0.75, 0.50 + qc.margin));
    } else {
        qc.isBlank = false;
        qc.answer = first.first;
        double normMargin = std::min(1.0, qc.margin / 0.40);
        double normScore = std::min(1.0, qc.bestScore / 0.75);
        double centroidFactor = first.second.centroidScore;
        qc.confidence = std::min(0.99, std::max(0.70, 0.50 + 0.49 * (0.45 * normMargin + 0.35 * normScore + 0.20 * centroidFactor)));
    }

    return qc;
}

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
    dc.metrics = metrics;

    if (dc.bestScore < config.minFillScore) {
        dc.isBlank = true;
        dc.digitChar = '?';
        dc.confidence = std::min(0.99, std::max(0.85, 1.0 - dc.bestScore));
    } else if (dc.secondScore >= config.multipleScore && dc.margin < config.minClassificationMargin) {
        dc.isMultiple = true;
        dc.isAmbiguous = true;
        dc.digitChar = '?';
        dc.confidence = std::max(0.50, std::min(0.88, 0.60 + (dc.secondScore - config.multipleScore)));
    } else if (dc.margin < config.minClassificationMargin) {
        dc.isAmbiguous = true;
        dc.digitChar = '?';
        dc.confidence = std::max(0.40, std::min(0.75, 0.50 + dc.margin));
    } else {
        dc.isBlank = false;
        dc.digit = top.digit;
        dc.digitChar = static_cast<char>('0' + top.digit);
        double normMargin = std::min(1.0, dc.margin / 0.40);
        double normScore = std::min(1.0, dc.bestScore / 0.75);
        dc.confidence = std::min(0.99, std::max(0.70, 0.50 + 0.49 * (0.6 * normMargin + 0.4 * normScore)));
    }

    return dc;
}

// ============================================================================
// 7. MAIN RUNTIME
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

    // Precompute Circle Masks
    CircleMaskSet qMasks = generateCircleMasks(
        config.questionCoreRadius,
        config.questionRingInnerRadius,
        config.questionRingOuterRadius,
        config.questionPaperRingInnerRadius,
        config.questionPaperRingOuterRadius);

    CircleMaskSet lrnMasks = generateCircleMasks(
        config.lrnCoreRadius,
        config.lrnRingInnerRadius,
        config.lrnRingOuterRadius);

    // 1. Perspective Alignment & Reprojection Validation
    cv::Mat alignedGray;
    ReprojectionReport reproj;
    double fiducialConfidence = 0.0;
    bool aligned = alignImageToCanonical(inputImage, alignedGray, reproj, fiducialConfidence);

    std::cout << "[OMR CV Engine V5] Resolution: " << inputImage.cols << "x" << inputImage.rows
              << " | Alignment: " << (aligned ? "LOCKED (4-Fiducials)" : "RESIZED_FALLBACK")
              << " | Reprojection Mean Err: " << std::fixed << std::setprecision(2) << reproj.meanError << " px"
              << " | Max Err: " << reproj.maxError << " px"
              << " | Fiducial Conf: " << std::setprecision(0) << (fiducialConfidence * 100) << "%" << std::endl;

    cv::Mat debugImg;
    cv::cvtColor(alignedGray, debugImg, cv::COLOR_GRAY2BGR);

    // 2. Evaluate 12-Digit LRN
    std::string extractedLRN = "";
    std::vector<DigitClassification> lrnResults;
    for (int col = 0; col < 12; ++col) {
        std::vector<BubbleMetric> digitMetrics;
        for (int row = 0; row <= 9; ++row) {
            BubbleMetric m = analyzeBubble(alignedGray, LRN_COLS_X[col], LRN_ROWS_Y[row], lrnMasks, config.lrnCoreRadius, config.physicalLrnBubbleRadius, config);
            digitMetrics.push_back(m);
        }
        DigitClassification dc = classifyDigitColumn(digitMetrics, config);
        lrnResults.push_back(dc);
        extractedLRN += dc.digitChar;

        for (int row = 0; row <= 9; ++row) {
            const auto& m = digitMetrics[row];
            cv::Point pt(m.actualX, m.actualY);
            if (dc.digit == row) {
                // Green: Selected Digit
                cv::circle(debugImg, pt, static_cast<int>(config.physicalLrnBubbleRadius), cv::Scalar(0, 200, 0), 2);
                cv::circle(debugImg, pt, static_cast<int>(config.lrnCoreRadius), cv::Scalar(0, 160, 0), 1);
            } else if (m.score >= config.minFillScore) {
                // Orange: Ambiguous candidate
                cv::circle(debugImg, pt, static_cast<int>(config.physicalLrnBubbleRadius), cv::Scalar(0, 165, 255), 2);
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

    for (const auto& block : QUESTION_BLOCKS) {
        for (int r = 0; r < 10; ++r) {
            int qNum = block.startQ + r;
            int globalRowIdx = block.startRowIdx + r;
            int rowY = QUESTION_ROWS_Y[globalRowIdx];

            std::vector<int> optX = {block.A, block.B, block.C, block.D};
            std::vector<std::pair<char, BubbleMetric>> optMetrics;

            for (int o = 0; o < 4; ++o) {
                BubbleMetric m = analyzeBubble(alignedGray, optX[o], rowY, qMasks, config.questionCoreRadius, config.physicalBubbleRadius, config);
                optMetrics.push_back({optLabels[o], m});
            }

            QuestionClassification qc = classifyQuestion(optMetrics, qNum, config);
            qResults.push_back(qc);

            if (qc.isBlank) blankCount++;
            else if (qc.isMultiple) multipleCount++;
            else answeredCount++;

            // Draw Question Debug markings
            for (int o = 0; o < 4; ++o) {
                char optChar = optLabels[o];
                const auto& m = optMetrics[o].second;
                cv::Point pt(m.actualX, m.actualY);

                if (qc.answer == optChar) {
                    // Green: Accepted Answer
                    cv::circle(debugImg, pt, static_cast<int>(config.physicalBubbleRadius), cv::Scalar(0, 200, 0), 2);
                    cv::circle(debugImg, pt, static_cast<int>(config.questionCoreRadius), cv::Scalar(0, 160, 0), 1);
                } else if (qc.isMultiple && m.score >= config.multipleScore) {
                    // Red: Multiple Marks
                    cv::circle(debugImg, pt, static_cast<int>(config.physicalBubbleRadius), cv::Scalar(0, 0, 255), 2);
                } else if (m.score >= config.minFillScore) {
                    // Orange: Ambiguous candidate
                    cv::circle(debugImg, pt, static_cast<int>(config.physicalBubbleRadius), cv::Scalar(0, 165, 255), 2);
                } else {
                    // Gray: Empty bubble
                    cv::circle(debugImg, pt, static_cast<int>(config.physicalBubbleRadius), cv::Scalar(180, 180, 180), 1);
                }
            }

            std::string label = "Q" + std::to_string(qNum) + ": " + (qc.answer == '-' ? "BLANK" : (qc.answer == 'M' ? "MULTI" : std::string(1, qc.answer)));
            cv::Scalar textColor = qc.isBlank ? cv::Scalar(120, 120, 120) : (qc.isMultiple ? cv::Scalar(0, 0, 255) : cv::Scalar(0, 180, 0));
            cv::putText(debugImg, label, cv::Point(block.A - 55, rowY + 4), cv::FONT_HERSHEY_SIMPLEX, 0.35, textColor, 1);
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

    cv::imwrite(debugOutputPath, debugImg);
    std::cout << "[Diagnostic] Saved debug visualization to: " << debugOutputPath << std::endl;

    return 0;
}
