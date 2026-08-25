export type OptionType = "A" | "B" | "C" | "D" | "MULTIPLE" | null;

export interface OMRAnswer {
  item_number: number;
  selected_option: OptionType;
  confidence?: number;
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
