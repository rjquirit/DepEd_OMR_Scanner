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
  innerMean: number;
  ringMean: number;
  contrast: number;
  p10: number;
  p20: number;
  p30: number;
  darkRatio: number;
  filledAreaRatio: number;
  largestComponentRatio: number;
  componentCount: number;
  centroidOffset: number;
  centroidScore: number;
  templateDifference: number;
  finalScore: number;
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

export interface ImageQualityMetrics {
  sharpness: number;
  illuminationUniformity: number;
  sheetCoverage: number;
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
  telemetry?: {
    algorithm: string;
    totalBubblesEvaluated: number;
    filledCount: number;
    blankCount: number;
    multipleCount: number;
    averageConfidence: number;
    alignmentStatus: string;
    scanId?: string;
  };
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

export interface ScannedRecord {
  id: string;
  timestamp: string;
  student_lrn: string;
  student_name: string | null;
  section: string | null;
  subject: string | null;
  score?: number;
  total_items?: number;
  percentage?: number;
  passed?: boolean;
  scan_result: OMRScanResult;
  image_preview?: string;
}

