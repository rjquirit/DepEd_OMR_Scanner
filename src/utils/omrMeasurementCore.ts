import { OMRConfig, DEFAULT_OMR_CONFIG } from "./omrConfig";
import { OptionType } from "../types";

export interface BubbleMetric {
  cx: number;
  cy: number;
  radius: number;
  innerMean: number;
  ringMean: number;
  p20: number;
  darkRatio: number;
  contrast: number;
  percentileDarkness: number;
  score: number;
  filled: boolean;
}

export interface QuestionClassification {
  questionNumber: number;
  answer: OptionType;
  bestOption: "A" | "B" | "C" | "D";
  bestScore: number;
  secondOption: "A" | "B" | "C" | "D";
  secondScore: number;
  margin: number;
  confidence: number; // 0.0 to 1.0
  isBlank: boolean;
  isMultiple: boolean;
  isAmbiguous: boolean;
  metrics: Record<"A" | "B" | "C" | "D", BubbleMetric>;
}

export interface DigitClassification {
  digitChar: string; // "0"-"9" or "?"
  digit: number | null;
  bestScore: number;
  secondScore: number;
  margin: number;
  confidence: number;
  isBlank: boolean;
  isMultiple: boolean;
  isAmbiguous: boolean;
  metrics: BubbleMetric[];
}

/**
 * Two-Zone Circular Measurement Model
 * Measures inner core (student graphite/ink) relative to outer ring (local paper background).
 * Completely eliminates dependence on absolute grayscale levels or darkest-pixel drifting.
 */
export function analyzeBubble(
  gray: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  config: OMRConfig = DEFAULT_OMR_CONFIG
): BubbleMetric {
  const innerRadius = radius * config.innerRadiusRatio;
  const ringInnerRadius = radius * config.ringInnerRatio;
  const ringOuterRadius = radius;

  const innerRadiusSq = innerRadius * innerRadius;
  const ringInnerRadiusSq = ringInnerRadius * ringInnerRadius;
  const ringOuterRadiusSq = ringOuterRadius * ringOuterRadius;

  let innerSum = 0;
  let ringSum = 0;
  let ringCount = 0;

  const innerPixels: number[] = [];
  const rInt = Math.ceil(radius);

  for (let dy = -rInt; dy <= rInt; dy++) {
    const py = cy + dy;
    if (py < 0 || py >= height) continue;
    const dySq = dy * dy;

    for (let dx = -rInt; dx <= rInt; dx++) {
      const px = cx + dx;
      if (px < 0 || px >= width) continue;

      const distSq = dx * dx + dySq;
      const val = gray[py * width + px];

      // 1. Inner Core: student shading zone
      if (distSq <= innerRadiusSq) {
        innerSum += val;
        innerPixels.push(val);
      }

      // 2. Outer Ring: local background paper reflectance estimation
      if (distSq >= ringInnerRadiusSq && distSq <= ringOuterRadiusSq) {
        ringSum += val;
        ringCount++;
      }
    }
  }

  const innerCount = innerPixels.length;
  const innerMean = innerCount > 0 ? innerSum / innerCount : 255.0;
  const ringMean = ringCount > 0 ? ringSum / ringCount : 255.0;

  // 3. Calculate P20 (20th percentile of inner core values) to capture light or partial pencil marks
  let p20 = 255.0;
  if (innerCount > 0) {
    innerPixels.sort((a, b) => a - b);
    const p20Idx = Math.floor(0.2 * (innerCount - 1));
    p20 = innerPixels[p20Idx];
  }

  // 4. Relative Local Contrast: (Paper - Core) / Paper
  const safeRingMean = Math.max(1.0, ringMean);
  const contrast = Math.max(0.0, (ringMean - innerMean) / safeRingMean);

  // 5. Percentile Darkness: (Paper - P20) / Paper
  const percentileDarkness = Math.max(0.0, (ringMean - p20) / safeRingMean);

  // 6. Adaptive Dark Pixel Ratio
  const adaptiveThreshold = ringMean - Math.max(config.adaptiveOffsetMin, ringMean * config.adaptiveOffsetRatio);
  let darkPixels = 0;
  for (let i = 0; i < innerCount; i++) {
    if (innerPixels[i] < adaptiveThreshold) {
      darkPixels++;
    }
  }
  const darkRatio = innerCount > 0 ? darkPixels / innerCount : 0.0;

  // 7. Weighted Composite Bubble Score
  const score =
    config.contrastWeight * contrast +
    config.darkRatioWeight * darkRatio +
    config.percentileWeight * percentileDarkness;

  const filled = score >= config.minScore;

  return {
    cx,
    cy,
    radius,
    innerMean,
    ringMean,
    p20,
    darkRatio,
    contrast,
    percentileDarkness,
    score,
    filled,
  };
}

/**
 * Question-Level Classifier (Evaluates A, B, C, D collectively)
 */
export function classifyQuestion(
  measurements: { option: "A" | "B" | "C" | "D"; metric: BubbleMetric }[],
  questionNum: number,
  config: OMRConfig = DEFAULT_OMR_CONFIG
): QuestionClassification {
  const sorted = [...measurements].sort((a, b) => b.metric.score - a.metric.score);
  const first = sorted[0];
  const second = sorted[1];

  const bestScore = first.metric.score;
  const secondScore = second ? second.metric.score : 0.0;
  const margin = bestScore - secondScore;

  let isBlank = false;
  let isMultiple = false;
  let isAmbiguous = false;
  let answer: OptionType = null;
  let confidence = 0.0;

  if (bestScore < config.minScore) {
    // 1. Blank Question: No option shaded significantly
    isBlank = true;
    answer = null;
    confidence = Math.min(0.99, Math.max(0.85, 1.0 - bestScore));
  } else if (secondScore >= config.multipleScore && margin < config.minMargin) {
    // 2. Multiple Marks: Two or more distinct shaded options with high scores and narrow margin
    isMultiple = true;
    isAmbiguous = true;
    answer = "MULTIPLE";
    confidence = Math.max(0.5, Math.min(0.9, 0.6 + (secondScore - config.multipleScore)));
  } else if (margin < config.minMargin) {
    // 3. Ambiguous: Top mark is above threshold, but runner-up is too close
    isAmbiguous = true;
    answer = "MULTIPLE";
    confidence = Math.max(0.45, Math.min(0.75, 0.5 + margin));
  } else {
    // 4. Clear Single Answer
    answer = first.option;
    const normalizedMargin = Math.min(1.0, margin / 0.5);
    const scoreFactor = Math.min(1.0, bestScore / 0.8);
    confidence = Math.min(0.99, Math.max(0.7, 0.5 + 0.3 * normalizedMargin + 0.2 * scoreFactor));
  }

  const metricsMap: Record<"A" | "B" | "C" | "D", BubbleMetric> = {} as any;
  measurements.forEach((m) => {
    metricsMap[m.option] = m.metric;
  });

  return {
    questionNumber: questionNum,
    answer,
    bestOption: first.option,
    bestScore,
    secondOption: second.option,
    secondScore,
    margin,
    confidence,
    isBlank,
    isMultiple,
    isAmbiguous,
    metrics: metricsMap,
  };
}

/**
 * Digit Column Classifier (Evaluates Digits 0 to 9)
 */
export function classifyDigitColumn(
  measurements: { digit: number; metric: BubbleMetric }[],
  config: OMRConfig = DEFAULT_OMR_CONFIG
): DigitClassification {
  const sorted = [...measurements].sort((a, b) => b.metric.score - a.metric.score);
  const first = sorted[0];
  const second = sorted[1];

  const bestScore = first.metric.score;
  const secondScore = second ? second.metric.score : 0.0;
  const margin = bestScore - secondScore;

  let isBlank = false;
  let isMultiple = false;
  let isAmbiguous = false;
  let digitChar = "?";
  let digit: number | null = null;
  let confidence = 0.0;

  if (bestScore < config.minScore) {
    isBlank = true;
    digitChar = "?";
    confidence = Math.min(0.99, Math.max(0.85, 1.0 - bestScore));
  } else if (secondScore >= config.multipleScore && margin < config.minMargin) {
    isMultiple = true;
    isAmbiguous = true;
    digitChar = "?";
    confidence = Math.max(0.5, Math.min(0.85, 0.6 + (secondScore - config.multipleScore)));
  } else if (margin < config.minMargin) {
    isAmbiguous = true;
    digitChar = "?";
    confidence = Math.max(0.45, Math.min(0.75, 0.5 + margin));
  } else {
    digit = first.digit;
    digitChar = first.digit.toString();
    const normalizedMargin = Math.min(1.0, margin / 0.5);
    const scoreFactor = Math.min(1.0, bestScore / 0.8);
    confidence = Math.min(0.99, Math.max(0.7, 0.5 + 0.3 * normalizedMargin + 0.2 * scoreFactor));
  }

  return {
    digitChar,
    digit,
    bestScore,
    secondScore,
    margin,
    confidence,
    isBlank,
    isMultiple,
    isAmbiguous,
    metrics: measurements.map((m) => m.metric),
  };
}
