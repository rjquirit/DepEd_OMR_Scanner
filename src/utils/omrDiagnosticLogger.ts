import {
  AlignmentMetrics,
  DatasetSplit,
  ErrorCategory,
  GroundTruthType,
  ImageQualityMetrics,
  OMRDiagnosticRecord,
  OptionType,
  QuestionDiagnosticLog,
} from "../types";

const DIAGNOSTIC_STORAGE_KEY = "deped_omr_diagnostic_records_v1";

/**
 * Generates an immutable, sequential/timestamped Scan ID: OMR-YYYY-XXXXXX
 */
export function generateScanId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `OMR-${year}-${rand}`;
}

/**
 * Calculates genuine image quality metrics from raw/normalized image arrays
 */
export function calculateImageQualityMetrics(
  gray: Uint8Array,
  width: number,
  height: number,
  reprojectionError: number = 0.0,
  fiducialConfidence: number = 0.95,
  sheetCoveragePct: number = 98.5
): ImageQualityMetrics {
  // 1. Sharpness: Discrete 3x3 Laplacian operator variance
  let lapSum = 0;
  let lapSumSq = 0;
  let lapCount = 0;
  let minIntensity = 255;
  let maxIntensity = 0;
  let totalIntensitySum = 0;

  const step = 4; // Sample every 4th pixel for high speed
  for (let y = step; y < height - step; y += step) {
    const rowOffset = y * width;
    for (let x = step; x < width - step; x += step) {
      const center = gray[rowOffset + x];
      const top = gray[(y - 1) * width + x];
      const bottom = gray[(y + 1) * width + x];
      const left = gray[rowOffset + x - 1];
      const right = gray[rowOffset + x + 1];

      const lap = Math.abs(4 * center - top - bottom - left - right);
      lapSum += lap;
      lapSumSq += lap * lap;
      lapCount++;

      if (center < minIntensity) minIntensity = center;
      if (center > maxIntensity) maxIntensity = center;
      totalIntensitySum += center;
    }
  }

  const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
  const lapVar = lapCount > 0 ? Math.max(0, lapSumSq / lapCount - lapMean * lapMean) : 0;
  const sharpness = Math.round(Math.min(100, Math.max(0, Math.sqrt(lapVar) * 2.5)) * 10) / 10;

  // 2. Illumination Uniformity: Quadrant sample variance
  const qW = Math.floor(width / 2);
  const qH = Math.floor(height / 2);
  const quadMeans = [0, 0, 0, 0];
  const quadCounts = [0, 0, 0, 0];

  for (let y = 20; y < height - 20; y += 10) {
    const qRow = y < qH ? 0 : 2;
    for (let x = 20; x < width - 20; x += 10) {
      const qCol = x < qW ? 0 : 1;
      const qIdx = qRow + qCol;
      quadMeans[qIdx] += gray[y * width + x];
      quadCounts[qIdx]++;
    }
  }

  for (let i = 0; i < 4; i++) {
    quadMeans[i] = quadCounts[i] > 0 ? quadMeans[i] / quadCounts[i] : 200;
  }

  const overallMean = (quadMeans[0] + quadMeans[1] + quadMeans[2] + quadMeans[3]) / 4;
  let devSum = 0;
  for (let i = 0; i < 4; i++) {
    devSum += Math.abs(quadMeans[i] - overallMean);
  }
  const illuminationUniformity = Math.round(Math.max(0, 100 - (devSum / 4) * 1.6) * 10) / 10;

  // 3. Contrast & Exposure
  const contrast = Math.round(Math.max(0, Math.min(100, ((maxIntensity - minIntensity) / 255) * 100)) * 10) / 10;
  const avgExposure = lapCount > 0 ? (totalIntensitySum / lapCount) / 255 * 100 : 75;
  const exposure = Math.round(avgExposure * 10) / 10;

  return {
    sharpness,
    illuminationUniformity,
    sheetCoverage: Math.round(sheetCoveragePct * 10) / 10,
    contrast,
    exposure,
    fiducialConfidence: Math.round(fiducialConfidence * 100) / 100,
    homographyReprojectionError: Math.round(reprojectionError * 100) / 100,
  };
}

/**
 * Automatically computes the exact ErrorCategory given predicted and human ground truth
 */
export function evaluateErrorCategory(
  predicted: OptionType,
  groundTruth: GroundTruthType
): { omrCorrect: boolean; errorCategory: ErrorCategory } {
  const normPred = predicted === null ? "-" : predicted;
  const normTruth = groundTruth;

  if (normTruth === "AMBIGUOUS") {
    return { omrCorrect: false, errorCategory: "AMBIGUOUS" };
  }

  if (normPred === normTruth) {
    if (normPred === "-") {
      return { omrCorrect: true, errorCategory: "CORRECT_BLANK" };
    }
    if (normPred === "MULTIPLE") {
      return { omrCorrect: true, errorCategory: "CORRECT_MULTIPLE" };
    }
    return { omrCorrect: true, errorCategory: "TRUE_POSITIVE" };
  }

  // Errors:
  if (normPred === "-" && normTruth !== "-") {
    return { omrCorrect: false, errorCategory: "FALSE_BLANK" };
  }

  if (normPred !== "-" && normTruth === "-") {
    return { omrCorrect: false, errorCategory: "FALSE_POSITIVE" };
  }

  if (normPred === "MULTIPLE" && normTruth !== "MULTIPLE") {
    return { omrCorrect: false, errorCategory: "WRONG_CHOICE" };
  }

  if (normPred !== "MULTIPLE" && normTruth === "MULTIPLE") {
    return { omrCorrect: false, errorCategory: "MISSED_MULTIPLE" };
  }

  return { omrCorrect: false, errorCategory: "WRONG_CHOICE" };
}

/**
 * Load all saved diagnostic records from localStorage
 */
export function loadDiagnosticRecords(): OMRDiagnosticRecord[] {
  try {
    const raw = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load diagnostic logs from localStorage:", err);
    return [];
  }
}

/**
 * Save diagnostic records to localStorage
 */
export function saveDiagnosticRecords(records: OMRDiagnosticRecord[]): void {
  try {
    // Keep max 50 recent records in local storage to prevent quota overflow
    const trimmed = records.slice(-50);
    localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error("Failed to save diagnostic logs to localStorage:", err);
  }
}

/**
 * Record a new scan diagnostic log with automatic 70/15/15 dataset partitioning
 */
export function recordDiagnosticLog(record: OMRDiagnosticRecord): void {
  const existing = loadDiagnosticRecords();

  if (!record.datasetSplit) {
    const rand = Math.random();
    if (rand < 0.7) {
      record.datasetSplit = "CALIBRATION";
    } else if (rand < 0.85) {
      record.datasetSplit = "VALIDATION";
    } else {
      record.datasetSplit = "REGRESSION";
    }
  }

  const updated = [...existing.filter((r) => r.scanId !== record.scanId), record];
  saveDiagnosticRecords(updated);
}

/**
 * Human Ground Truth Annotation update for a question in a recorded scan
 */
export function annotateGroundTruth(
  scanId: string,
  questionNum: number,
  actualMarked: GroundTruthType,
  notes?: string
): OMRDiagnosticRecord | null {
  const records = loadDiagnosticRecords();
  const recIndex = records.findIndex((r) => r.scanId === scanId);
  if (recIndex === -1) return null;

  const targetRec = records[recIndex];
  const qIndex = targetRec.questions.findIndex((q) => q.question === questionNum);
  if (qIndex === -1) return null;

  const q = targetRec.questions[qIndex];
  q.groundTruth = {
    actualMarked,
    source: "human_verified",
    reviewedAt: new Date().toISOString(),
    notes,
  };

  q.evaluation = evaluateErrorCategory(q.predicted, actualMarked);

  targetRec.groundTruthReviewed = true;
  targetRec.reviewedAt = new Date().toISOString();
  records[recIndex] = targetRec;

  saveDiagnosticRecords(records);
  return targetRec;
}

/**
 * Clear all diagnostic records
 */
export function clearDiagnosticLogs(): void {
  localStorage.removeItem(DIAGNOSTIC_STORAGE_KEY);
}

/**
 * Export complete dataset as JSON
 */
export function exportDiagnosticJson(records: OMRDiagnosticRecord[]): void {
  const jsonStr = JSON.stringify(records, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deped_omr_dataset_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export complete dataset as JSONL (JSON Lines)
 */
export function exportDiagnosticJsonLines(records: OMRDiagnosticRecord[]): void {
  const lines = records.map((r) => JSON.stringify(r)).join("\n");
  const blob = new Blob([lines], { type: "application/x-jsonlines" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deped_omr_dataset_${new Date().toISOString().split("T")[0]}.jsonl`;
  a.click();
  URL.revokeObjectURL(url);
}
