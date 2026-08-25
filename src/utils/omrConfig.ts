/**
 * Standardized OMR Configuration & Geometric Calibration (Version 5.0)
 * DepEd Region X 60-Item Answer Sheet (1467 x 2048 Canonical Resolution)
 */

export const OMR_ENGINE_VERSION = "5.0.0";
export const OMR_ALGORITHM_NAME = "TWO_ZONE_MULTI_FEATURE_CALIBRATED_V5";

export interface OMRConfig {
  configVersion: string;

  // Physical Dimensions (Canonical 1467 x 2048 space)
  canonicalWidth: number;
  canonicalHeight: number;
  physicalBubbleRadius: number; // Actual printed bubble circle radius (~15.0 px)
  physicalLrnBubbleRadius: number; // Actual printed LRN circle radius (~13.5 px)

  // Question Bubble Measurement Radii
  questionCoreRadius: number; // Student graphite inner core radius (e.g. 7.5 px)
  questionRingInnerRadius: number; // Inner radius of printed border reference ring (e.g. 12.0 px)
  questionRingOuterRadius: number; // Outer radius of printed border reference ring (e.g. 15.0 px)
  questionPaperRingInnerRadius: number; // Local clean paper annulus inner radius (e.g. 18.0 px)
  questionPaperRingOuterRadius: number; // Local clean paper annulus outer radius (e.g. 22.0 px)

  // LRN Bubble Measurement Radii
  lrnCoreRadius: number; // LRN student graphite inner core radius (e.g. 6.0 px)
  lrnRingInnerRadius: number; // LRN printed border ring inner radius (e.g. 10.0 px)
  lrnRingOuterRadius: number; // LRN printed border ring outer radius (e.g. 13.0 px)

  // Constrained Center Refinement
  centerSearchRadiusPx: number; // Search window radius (e.g. 4 to 6 px)
  maxCenterOffsetPx: number; // Max allowed center displacement (e.g. 6.0 px)

  // Adaptive Thresholding Parameters
  adaptiveOffsetMin: number; // Minimum luminance drop from local paper background (e.g. 18.0)
  adaptiveOffsetRatio: number; // Proportional luminance drop from paper background (e.g. 0.12)

  // Composite Scoring Weights (Must sum to 1.0)
  contrastWeight: number; // Relative local contrast weight (e.g. 0.35)
  darkRatioWeight: number; // Adaptive dark pixel ratio weight (e.g. 0.30)
  percentileWeight: number; // P20 percentile darkness weight (e.g. 0.20)
  componentWeight: number; // 8-connected component coherence weight (e.g. 0.10)
  centroidWeight: number; // Mass centroid centering score weight (e.g. 0.05)

  // Question-Level Decision Thresholds
  minFillScore: number; // Minimum composite score for a valid fill mark (e.g. 0.20)
  minClassificationMargin: number; // Margin between 1st & 2nd choice (best - second) (e.g. 0.10)
  multipleScore: number; // Score threshold triggering multi-mark evaluation (e.g. 0.20)

  // Alignment & Quality Gates
  minFiducialConfidence: number; // Minimum fiducial detection confidence (e.g. 0.70)
  maxReprojectionErrorPx: number; // Max acceptable homography reprojection error (e.g. 3.0 px)
  minSheetCoverage: number; // Min percentage of sheet visible (e.g. 90.0%)
}

export const DEFAULT_OMR_CONFIG: OMRConfig = {
  configVersion: "5.0.0",

  canonicalWidth: 1467,
  canonicalHeight: 2048,
  physicalBubbleRadius: 15.0,
  physicalLrnBubbleRadius: 13.5,

  questionCoreRadius: 7.5,
  questionRingInnerRadius: 12.0,
  questionRingOuterRadius: 15.0,
  questionPaperRingInnerRadius: 18.0,
  questionPaperRingOuterRadius: 22.0,

  lrnCoreRadius: 6.0,
  lrnRingInnerRadius: 10.0,
  lrnRingOuterRadius: 13.0,

  centerSearchRadiusPx: 12,
  maxCenterOffsetPx: 14.0,

  adaptiveOffsetMin: 18.0,
  adaptiveOffsetRatio: 0.12,

  contrastWeight: 0.35,
  darkRatioWeight: 0.30,
  percentileWeight: 0.20,
  componentWeight: 0.10,
  centroidWeight: 0.05,

  minFillScore: 0.20,
  minClassificationMargin: 0.10,
  multipleScore: 0.20,

  minFiducialConfidence: 0.70,
  maxReprojectionErrorPx: 3.0,
  minSheetCoverage: 90.0,
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

// 12-Digit LRN Grid Columns and 10 Digit Rows (0 to 9) - Calibrated for high-precision alignment
export const LRN_COLS_X = [322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760];
export const LRN_ROWS_Y = [428, 473, 518, 563, 608, 653, 697, 742, 788, 834];

// ============================================================================
// 60 Examination Items (3 Columns x Top & Bottom Sections)
//
// LEFT TOP:       Q01 - Q10 (Col 1, Rows 0..9)
// CENTER TOP:     Q11 - Q20 (Col 2, Rows 0..9)
// RIGHT TOP:      Q21 - Q30 (Col 3, Rows 0..9)
// LEFT BOTTOM:    Q31 - Q40 (Col 1, Rows 10..19)
// CENTER BOTTOM:  Q41 - Q50 (Col 2, Rows 10..19)
// RIGHT BOTTOM:   Q51 - Q60 (Col 3, Rows 10..19)
// ============================================================================

export const QUESTION_COLS_X = {
  col1: { A: 392, B: 436, C: 480, D: 524 }, // Column 1 (Left)
  col2: { A: 673, B: 717, C: 761, D: 807 }, // Column 2 (Center)
  col3: { A: 951, B: 997, C: 1041, D: 1087 }, // Column 3 (Right)
};

export const QUESTION_ROWS_Y = [
  // TOP Section (Rows 0 to 9: Q01-Q30)
  947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386,
  // BOTTOM Section (Rows 10 to 19: Q31-Q60) - Calibrated to match physical sheet spacing
  1478, 1528, 1577, 1625, 1673, 1722, 1771, 1820, 1868, 1918,
];

export interface QuestionBlockDef {
  id: "LEFT_TOP" | "CENTER_TOP" | "RIGHT_TOP" | "LEFT_BOTTOM" | "CENTER_BOTTOM" | "RIGHT_BOTTOM";
  title: string;
  column: 1 | 2 | 3;
  section: "TOP" | "BOTTOM";
  startQ: number;
  endQ: number;
  A: number;
  B: number;
  C: number;
  D: number;
  startRowIdx: number; // 0 for TOP, 10 for BOTTOM
}

export const QUESTION_BLOCKS: QuestionBlockDef[] = [
  { id: "LEFT_TOP", title: "LEFT TOP (Q01 - Q10)", column: 1, section: "TOP", startQ: 1, endQ: 10, ...QUESTION_COLS_X.col1, startRowIdx: 0 },
  { id: "CENTER_TOP", title: "CENTER TOP (Q11 - Q20)", column: 2, section: "TOP", startQ: 11, endQ: 20, ...QUESTION_COLS_X.col2, startRowIdx: 0 },
  { id: "RIGHT_TOP", title: "RIGHT TOP (Q21 - Q30)", column: 3, section: "TOP", startQ: 21, endQ: 30, ...QUESTION_COLS_X.col3, startRowIdx: 0 },
  { id: "LEFT_BOTTOM", title: "LEFT BOTTOM (Q31 - Q40)", column: 1, section: "BOTTOM", startQ: 31, endQ: 40, ...QUESTION_COLS_X.col1, startRowIdx: 10 },
  { id: "CENTER_BOTTOM", title: "CENTER BOTTOM (Q41 - Q50)", column: 2, section: "BOTTOM", startQ: 41, endQ: 50, ...QUESTION_COLS_X.col2, startRowIdx: 10 },
  { id: "RIGHT_BOTTOM", title: "RIGHT BOTTOM (Q51 - Q60)", column: 3, section: "BOTTOM", startQ: 51, endQ: 60, ...QUESTION_COLS_X.col3, startRowIdx: 10 },
];

export interface QuestionCoordDef {
  questionNumber: number;
  blockId: "LEFT_TOP" | "CENTER_TOP" | "RIGHT_TOP" | "LEFT_BOTTOM" | "CENTER_BOTTOM" | "RIGHT_BOTTOM";
  column: 1 | 2 | 3;
  section: "TOP" | "BOTTOM";
  rowIdx: number; // 0 to 9 within section block
  globalRowIdx: number; // 0 to 19 across sheet
  y: number;
  A: number;
  B: number;
  C: number;
  D: number;
}

export function getQuestionCoordinateDef(qNum: number): QuestionCoordDef {
  for (const block of QUESTION_BLOCKS) {
    if (qNum >= block.startQ && qNum <= block.endQ) {
      const rowIdx = qNum - block.startQ;
      const globalRowIdx = block.startRowIdx + rowIdx;
      return {
        questionNumber: qNum,
        blockId: block.id,
        column: block.column,
        section: block.section,
        rowIdx,
        globalRowIdx,
        y: QUESTION_ROWS_Y[globalRowIdx],
        A: block.A,
        B: block.B,
        C: block.C,
        D: block.D,
      };
    }
  }
  return {
    questionNumber: qNum,
    blockId: "LEFT_TOP",
    column: 1,
    section: "TOP",
    rowIdx: 0,
    globalRowIdx: 0,
    y: QUESTION_ROWS_Y[0],
    A: 392,
    B: 436,
    C: 480,
    D: 524,
  };
}

// Backward compatible QUESTION_COLUMNS alias
export const QUESTION_COLUMNS = QUESTION_BLOCKS;
