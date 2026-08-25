export type OptionType = "A" | "B" | "C" | "D" | "MULTIPLE" | null;

export type GroundTruthType = "A" | "B" | "C" | "D" | "-" | "MULTIPLE" | "AMBIGUOUS";

export type ErrorCategory =
  | "TRUE_POSITIVE"
  | "FALSE_POSITIVE"
  | "FALSE_NEGATIVE"
  | "WRONG_CHOICE"
  | "CORRECT_BLANK"
  | "FALSE_BLANK"
  | "CORRECT_MULTIPLE"
  | "MISSED_MULTIPLE"
  | "AMBIGUOUS"
  | "REGISTRATION_ERROR"
  | "IMAGE_QUALITY_ERROR";

export type DatasetSplit = "CALIBRATION" | "VALIDATION" | "REGRESSION";

export interface BubbleFeatures {
  coreMean: number;
  innerMean: number;
  ringMean: number;
  p10: number;
  p20: number;
  p30: number;
  darkRatio: number;
  contrast: number;
  percentileDarkness: number;
  filledAreaRatio: number;
  largestComponentRatio: number;
  componentCount: number;
  centroidOffset: number;
  centroidScore: number;
  templateDifference: number;
  score: number;
  finalScore?: number;
}

export interface BubbleGeometry {
  expectedX: number;
  expectedY: number;
  actualX: number;
  actualY: number;
  radius: number;
  offsetX: number;
  offsetY: number;
}

export interface BubbleResult {
  geometry: BubbleGeometry;
  features: BubbleFeatures;
  filled: boolean;
}

export interface BubbleChoiceRecord {
  score: number;
  features: BubbleFeatures;
  geometry: BubbleGeometry;
}

export interface QuestionDiagnosticLog {
  question: number;
  predicted: OptionType;
  confidence: number;
  bestScore: number;
  secondScore: number;
  margin: number;
  blank: boolean;
  multiple: boolean;
  ambiguous: boolean;
  choices: Record<"A" | "B" | "C" | "D", BubbleChoiceRecord>;
  groundTruth?: {
    actualMarked: GroundTruthType;
    source: "human_verified" | "synthetic" | "batch_labeled";
    reviewedAt: string;
    notes?: string;
  };
  evaluation?: {
    omrCorrect: boolean;
    errorCategory: ErrorCategory;
  };
}

export interface AlignmentMetrics {
  valid: boolean;
  fiducialsDetected: number;
  fiducialConfidence: number;
  fallbackUsed: boolean;
  alignmentStatus: string;
  reprojectionErrorPx: number;
  maxReprojectionErrorPx: number;
  cornerErrors?: {
    tl: number;
    tr: number;
    br: number;
    bl: number;
  };
}

export interface ImageQualityMetrics {
  sharpness: number;
  illuminationUniformity: number;
  sheetCoverage: number;
  contrast: number;
  exposure: number;
  fiducialConfidence: number;
  homographyReprojectionError: number;
}

export interface OMRDiagnosticRecord {
  scanId: string;
  timestamp: string;
  engineVersion: string;
  algorithmVersion: string;
  datasetSplit?: DatasetSplit;
  image: {
    width: number;
    height: number;
    format?: string;
    fileSizeKb?: number;
  };
  alignment?: AlignmentMetrics;
  quality: ImageQualityMetrics & {
    processingTimeMs: number;
  };
  studentLrn: string;
  questions: QuestionDiagnosticLog[];
  groundTruthReviewed?: boolean;
  reviewedAt?: string;
}

export interface OMRAnswer {
  item_number: number;
  selected_option: OptionType;
  confidence?: number;
  bestScore?: number;
  secondScore?: number;
  margin?: number;
  status?: "CLEAR" | "BLANK" | "MULTIPLE" | "AMBIGUOUS";
  diagnostic?: QuestionDiagnosticLog;
}

export interface OMRMetadata {
  name: string | null;
  section: string | null;
  school_id: string | null;
  grade_level: string | null;
  subject: string | null;
}

export interface OMRScanResult {
  student_lrn: string;
  metadata: OMRMetadata;
  answers: OMRAnswer[];
  raw_text?: string;
  scan_timestamp?: string;
  processing_time_ms?: number;
  image_preview?: string;
  debug_preview?: string;
  diagnostic_record?: OMRDiagnosticRecord;
  alignment?: AlignmentMetrics;
  telemetry?: {
    algorithm: string;
    totalBubblesEvaluated: number;
    filledCount: number;
    blankCount: number;
    multipleCount: number;
    averageConfidence: number;
    alignmentStatus: string;
    scanId?: string;
    scanQuality?: "GOOD" | "WARNING" | "REJECT";
  };
}

export interface ItemGrading {
  item_number: number;
  student_answer: OptionType;
  correct_answer?: "A" | "B" | "C" | "D";
  is_correct: boolean;
  status: "correct" | "incorrect" | "unanswered" | "multiple" | "no_key";
}

export interface GradingResult {
  score: number;
  total_items: number;
  percentage: number;
  passed: boolean;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  multiple_count: number;
  items: ItemGrading[];
}

export interface AnswerKey {
  id: string;
  title: string;
  subject: string;
  grade_level?: string;
  created_at: string;
  passing_score_percentage: number;
  total_items: number;
  keys: Record<number, "A" | "B" | "C" | "D">;
}

export interface ScannedRecord {
  id: string;
  student_lrn: string;
  student_name?: string;
  section?: string;
  subject?: string;
  timestamp?: string;
  score: number;
  total_items: number;
  percentage: number;
  passed: boolean;
  answers: Record<number, OptionType>;
  scanned_at: string;
  answer_key_id: string;
  answer_key_title: string;
  confidence_avg: number;
  diagnostic_scan_id?: string;
  image_preview?: string;
  scan_result?: OMRScanResult;
}
