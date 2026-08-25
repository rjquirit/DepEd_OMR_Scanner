/**
 * OMR Scanner Engine in C++ (OpenCV)
 * Calibrated for 60-Item Bubble Sheets with 12-Digit Student LRN
 *
 * Requirements: OpenCV 4.x
 * Compile with:
 *   g++ -O3 omr_scanner.cpp -o omr_scanner `pkg-config --cflags --libs opencv4`
 * Usage:
 *   ./omr_scanner "sample answered 60 item bubble sheet.png"
 */

#include <opencv2/opencv.hpp>
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <cmath>
#include <iomanip>

// Canonical Reference Dimensions calibrated to the 60-item sheet
const int REF_WIDTH = 1467;
const int REF_HEIGHT = 2048;

// 4 Corner Fiducial centers in Canonical Reference Coordinate Space
const cv::Point2f TARGET_TL(110.0f, 252.0f);
const cv::Point2f TARGET_TR(1355.0f, 252.0f);
const cv::Point2f TARGET_BR(1355.0f, 1928.0f);
const cv::Point2f TARGET_BL(110.0f, 1928.0f);

// 12 LRN Columns (X) and 10 Rows (Y for digits 0-9)
const std::vector<int> LRN_COLS_X = {322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760};
const std::vector<int> LRN_ROWS_Y = {428, 473, 518, 563, 608, 653, 697, 738, 783, 828};

// 60-Item Answer Section (3 Columns x 20 Questions)
struct QuestionColumn {
    int startQ;
    int A, B, C, D;
};

const std::vector<QuestionColumn> Q_COLS = {
    {1, 392, 436, 480, 524},
    {21, 673, 717, 761, 807},
    {41, 951, 997, 1041, 1087}
};

const std::vector<int> Q_ROWS_Y = {
    947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386,
    1464, 1514, 1563, 1611, 1659, 1708, 1757, 1806, 1854, 1903
};

struct BubbleMetric {
    int x;
    int y;
    double meanGray;
    double innerMeanGray;
    double fillRatio;
    double score;
    bool isFilled;
};

/**
 * 1. Automatic Fiducial Detection and Perspective Correction
 */
bool alignImageToCanonical(const cv::Mat& inputImg, cv::Mat& outputAligned) {
    cv::Mat gray;
    if (inputImg.channels() == 3) {
        cv::cvtColor(inputImg, gray, cv::COLOR_BGR2GRAY);
    } else {
        gray = inputImg.clone();
    }

    // Binary inverse threshold to find black fiducial corner blocks
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
        double area = r.width * r.height;
        // Looking for ~30x30 square fiducial markers relative to image size
        double minDim = std::min(imgW, imgH) * 0.012;
        double maxDim = std::min(imgW, imgH) * 0.050;

        if (r.width >= minDim && r.width <= maxDim && r.height >= minDim && r.height <= maxDim) {
            double aspect = (double)r.width / (double)r.height;
            if (aspect >= 0.75 && aspect <= 1.35) {
                cv::Moments m = cv::moments(cnt);
                if (m.m00 > 0) {
                    candidates.push_back({cv::Point2f(m.m10 / m.m00, m.m01 / m.m00), area, aspect});
                }
            }
        }
    }

    // Identify corners by quadrant if 4 fiducials are detected
    cv::Point2f foundTL(-1, -1), foundTR(-1, -1), foundBR(-1, -1), foundBL(-1, -1);

    for (const auto& c : candidates) {
        if (c.center.x < imgW * 0.35 && c.center.y < imgH * 0.35) foundTL = c.center;
        else if (c.center.x > imgW * 0.65 && c.center.y < imgH * 0.35) foundTR = c.center;
        else if (c.center.x > imgW * 0.65 && c.center.y > imgH * 0.65) foundBR = c.center;
        else if (c.center.x < imgW * 0.35 && c.center.y > imgH * 0.65) foundBL = c.center;
    }

    // If all 4 corner fiducials found, apply warpPerspective
    if (foundTL.x > 0 && foundTR.x > 0 && foundBR.x > 0 && foundBL.x > 0) {
        std::vector<cv::Point2f> srcQuad = {foundTL, foundTR, foundBR, foundBL};
        std::vector<cv::Point2f> dstQuad = {TARGET_TL, TARGET_TR, TARGET_BR, TARGET_BL};
        cv::Mat M = cv::getPerspectiveTransform(srcQuad, dstQuad);
        cv::warpPerspective(gray, outputAligned, M, cv::Size(REF_WIDTH, REF_HEIGHT), cv::INTER_CUBIC);
        return true;
    }

    // Fallback: direct resize if fiducials aren't fully framed
    cv::resize(gray, outputAligned, cv::Size(REF_WIDTH, REF_HEIGHT), 0, 0, cv::INTER_AREA);
    return false;
}

/**
 * 2. Optical Density Evaluator with Sub-Pixel Local Centroid Search
 * Uses concentric circular kernels to differentiate solid pencil marks from printed bubble borders/letters.
 */
BubbleMetric evaluateBubble(const cv::Mat& gray, int expectedX, int expectedY, double radius = 10.0) {
    int bestX = expectedX;
    int bestY = expectedY;
    double minCore = 255.0;

    // Search local +/- 6px window for darkest peak (student shading center)
    for (int dy = -6; dy <= 6; dy += 2) {
        for (int dx = -6; dx <= 6; dx += 2) {
            int cx = expectedX + dx;
            int cy = expectedY + dy;
            double sum = 0.0;
            int cnt = 0;

            for (int iy = -3; iy <= 3; iy++) {
                for (int ix = -3; ix <= 3; ix++) {
                    int px = cx + ix;
                    int py = cy + iy;
                    if (px >= 0 && px < gray.cols && py >= 0 && py < gray.rows) {
                        sum += gray.at<uchar>(py, px);
                        cnt++;
                    }
                }
            }

            double avg = cnt > 0 ? (sum / cnt) : 255.0;
            if (avg < minCore) {
                minCore = avg;
                bestX = cx;
                bestY = cy;
            }
        }
    }

    // Evaluate concentric circles around bestX, bestY
    double sumGray = 0.0;
    double sumInnerGray = 0.0;
    int totalPixels = 0;
    int innerPixels = 0;
    int darkPixels = 0;

    int rInt = (int)std::ceil(radius);
    double rSq = radius * radius;
    double innerRSq = (radius * 0.55) * (radius * 0.55);

    for (int dy = -rInt; dy <= rInt; dy++) {
        for (int dx = -rInt; dx <= rInt; dx++) {
            double dSq = dx * dx + dy * dy;
            if (dSq <= rSq) {
                int px = bestX + dx;
                int py = bestY + dy;
                if (px >= 0 && px < gray.cols && py >= 0 && py < gray.rows) {
                    uchar val = gray.at<uchar>(py, px);
                    sumGray += val;
                    totalPixels++;
                    if (val < 140) darkPixels++;

                    if (dSq <= innerRSq) {
                        sumInnerGray += val;
                        innerPixels++;
                    }
                }
            }
        }
    }

    double meanGray = totalPixels > 0 ? (sumGray / totalPixels) : 255.0;
    double innerMeanGray = innerPixels > 0 ? (sumInnerGray / innerPixels) : 255.0;
    double fillRatio = totalPixels > 0 ? ((double)darkPixels / totalPixels) : 0.0;

    double darkness = 1.0 - (meanGray / 255.0);
    double innerDarkness = 1.0 - (innerMeanGray / 255.0);

    // Weighted score: 65% weight on the solid inner core to ignore outer letter outlines
    double score = darkness * 0.35 + innerDarkness * 0.65;
    bool isFilled = (score >= 0.38 && meanGray <= 165.0);

    return {bestX, bestY, meanGray, innerMeanGray, fillRatio, score, isFilled};
}

/**
 * Main OMR Scanner Process
 */
int main(int argc, char** argv) {
    if (argc < 2) {
        std::cout << "Usage: " << argv[0] << " <image_path>" << std::endl;
        return 1;
    }

    std::string imagePath = argv[1];
    cv::Mat inputImage = cv::imread(imagePath);
    if (inputImage.empty()) {
        std::cerr << "Error: Could not load image: " << imagePath << std::endl;
        return 1;
    }

    cv::Mat alignedGray;
    bool aligned = alignImageToCanonical(inputImage, alignedGray);
    std::cout << "[OMR Engine] Image Loaded: " << inputImage.cols << "x" << inputImage.rows
              << " | Perspective Alignment: " << (aligned ? "LOCKED (4-Fiducials)" : "RESIZED_FALLBACK") << std::endl;

    // Optional: Contrast Stretch
    double minVal, maxVal;
    cv::minMaxLoc(alignedGray, &minVal, &maxVal);
    cv::Mat normalized;
    if (maxVal > minVal) {
        alignedGray.convertTo(normalized, CV_8U, 255.0 / (maxVal - minVal), -minVal * 255.0 / (maxVal - minVal));
    } else {
        normalized = alignedGray;
    }

    // 1. Extract 12-Digit LRN
    std::string extractedLRN = "";
    for (int col = 0; col < 12; col++) {
        struct DigitScore { int digit; double score; double mean; };
        std::vector<DigitScore> scores;

        for (int row = 0; row <= 9; row++) {
            BubbleMetric m = evaluateBubble(normalized, LRN_COLS_X[col], LRN_ROWS_Y[row], 9.0);
            scores.push_back({row, m.score, m.meanGray});
        }

        std::sort(scores.begin(), scores.end(), [](const DigitScore& a, const DigitScore& b) {
            return a.score > b.score;
        });

        auto top = scores[0];
        auto second = scores[1];

        if (top.score >= 0.38 && top.mean <= 165.0) {
            if (second.score >= 0.38 && (second.score / top.score) >= 0.85) {
                extractedLRN += "?"; // Ambiguous multiple marks
            } else {
                extractedLRN += std::to_string(top.digit);
            }
        } else {
            extractedLRN += "?"; // Blank column
        }
    }

    std::cout << "\n==========================================" << std::endl;
    std::cout << ">>> EXTRACTED STUDENT LRN: " << extractedLRN << std::endl;
    std::cout << "==========================================\n" << std::endl;

    // 2. Extract 60 Question Answers
    const std::vector<std::string> optLabels = {"A", "B", "C", "D"};
    int filledCount = 0;

    std::cout << "--- 60-ITEM ANSWERS ---" << std::endl;
    for (int c = 0; c < 3; c++) {
        const auto& col = Q_COLS[c];
        std::cout << "\n[Column " << (c + 1) << " (Q" << col.startQ << " - Q" << (col.startQ + 19) << ")]" << std::endl;

        for (int r = 0; r < 20; r++) {
            int qNum = col.startQ + r;
            int rowY = Q_ROWS_Y[r];

            std::vector<int> optX = {col.A, col.B, col.C, col.D};
            struct OptResult { std::string label; double score; double mean; };
            std::vector<OptResult> optResults;

            for (size_t o = 0; o < 4; o++) {
                BubbleMetric m = evaluateBubble(normalized, optX[o], rowY, 10.0);
                optResults.push_back({optLabels[o], m.score, m.meanGray});
            }

            std::sort(optResults.begin(), optResults.end(), [](const OptResult& a, const OptResult& b) {
                return a.score > b.score;
            });

            auto first = optResults[0];
            auto second = optResults[1];

            std::string ans = "BLANK";
            if (first.score >= 0.38 && first.mean <= 165.0) {
                if (second.score >= 0.38 && (second.score / first.score) >= 0.85) {
                    ans = "MULTIPLE";
                } else {
                    ans = first.label;
                    filledCount++;
                }
            }

            std::cout << "Q" << std::setw(2) << std::setfill('0') << qNum << ": "
                      << std::setw(8) << std::left << ans
                      << " (Score: " << std::fixed << std::setprecision(2) << first.score
                      << ", Mean: " << (int)first.mean << ")" << std::endl;
        }
    }

    std::cout << "\n==========================================" << std::endl;
    std::cout << "TOTAL ANSWERED: " << filledCount << " / 60" << std::endl;
    std::cout << "==========================================" << std::endl;

    return 0;
}
