/**
 * Standardized OMR Configuration & Geometric Calibration
 * Based on DepEd Region X 60-Item Answer Sheet (1467 x 2048 Canonical Resolution)
 */

export interface OMRConfig {
  // Bubble Geometry
  bubbleRadius: number; // Question choice bubble outer radius (px)
  lrnBubbleRadius: number; // LRN digit bubble outer radius (px)
  innerRadiusRatio: number; // Ratio of outer radius for inner core (e.g. 0.55)
  ringInnerRatio: number; // Ratio of outer radius for outer ring inner boundary (e.g. 0.72)

  // Scoring Weights (sums to 1.0)
  contrastWeight: number; // Weight for local relative contrast (ringMean - innerMean) / ringMean
  darkRatioWeight: number; // Weight for proportion of dark pixels in core vs adaptive threshold
  percentileWeight: number; // Weight for 20th percentile darkness (ringMean - p20) / ringMean

  // Adaptive Thresholding Parameters
  adaptiveOffsetMin: number; // Minimum luminance drop from local paper background (e.g. 18.0)
  adaptiveOffsetRatio: number; // Proportional luminance drop from paper background (e.g. 0.12)

  // Question-Level Classification Thresholds
  minScore: number; // Minimum score for a mark to be considered filled (e.g. 0.20)
  minMargin: number; // Minimum difference between 1st and 2nd choice to declare a single winner (e.g. 0.10)
  multipleScore: number; // Minimum score of 2nd choice to trigger a MULTIPLE mark flag (e.g. 0.20)
}

export const DEFAULT_OMR_CONFIG: OMRConfig = {
  bubbleRadius: 11.0,
  lrnBubbleRadius: 9.5,
  innerRadiusRatio: 0.55,
  ringInnerRatio: 0.72,

  contrastWeight: 0.45,
  darkRatioWeight: 0.35,
  percentileWeight: 0.20,

  adaptiveOffsetMin: 18.0,
  adaptiveOffsetRatio: 0.12,

  minScore: 0.20,
  minMargin: 0.10,
  multipleScore: 0.20,
};

// Canonical Dimensions
export const REF_WIDTH = 1467;
export const REF_HEIGHT = 2048;

// 4 Corner Fiducial Marker Centers (1467 x 2048 space)
export const TARGET_FIDUCIALS = {
  tl: { x: 110.0, y: 252.0 },
  tr: { x: 1355.0, y: 252.0 },
  br: { x: 1355.0, y: 1928.0 },
  bl: { x: 110.0, y: 1928.0 },
};

// 12-Digit LRN Grid Columns and 10 Digit Rows (0 to 9)
export const LRN_COLS_X = [322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760];
export const LRN_ROWS_Y = [428, 473, 518, 563, 608, 653, 697, 738, 783, 828];

// 60 Examination Items (3 Columns x 20 Rows)
export interface QuestionColumnLayout {
  startQ: number;
  endQ: number;
  A: number;
  B: number;
  C: number;
  D: number;
}

export const QUESTION_COLUMNS: QuestionColumnLayout[] = [
  { startQ: 1, endQ: 20, A: 392, B: 436, C: 480, D: 524 },
  { startQ: 21, endQ: 40, A: 673, B: 717, C: 761, D: 807 },
  { startQ: 41, endQ: 60, A: 951, B: 997, C: 1041, D: 1087 },
];

export const QUESTION_ROWS_Y = [
  947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386,
  1464, 1514, 1563, 1611, 1659, 1708, 1757, 1806, 1854, 1903,
];
