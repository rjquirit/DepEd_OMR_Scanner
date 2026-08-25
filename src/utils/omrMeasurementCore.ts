import { OMRConfig, DEFAULT_OMR_CONFIG } from "./omrConfig";
import { BubbleChoiceRecord, BubbleFeatures, BubbleGeometry, OptionType, QuestionDiagnosticLog } from "../types";

export interface BubbleMetric {
  cx: number;
  cy: number;
  expectedX: number;
  expectedY: number;
  radius: number;
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
  diagnosticLog: QuestionDiagnosticLog;
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
 * Two-Zone Circular Measurement Model with Rich Feature Extraction
 * Features extracted:
 * - innerMean, ringMean, contrast
 * - p10, p20, p30 percentiles
 * - adaptive darkRatio
 * - connected-component analysis (largestComponentRatio, componentCount, filledAreaRatio)
 * - centroid mass offset & dispersion score
 * - templateDifference baseline
 */
export function analyzeBubble(
  gray: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  config: OMRConfig = DEFAULT_OMR_CONFIG,
  expectedX: number = cx,
  expectedY: number = cy
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

  interface InnerPixel {
    x: number;
    y: number;
    dx: number;
    dy: number;
    val: number;
  }

  const innerPixels: InnerPixel[] = [];
  const innerValues: number[] = [];
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
        innerPixels.push({ x: px, y: py, dx, dy, val });
        innerValues.push(val);
      }

      // 2. Outer Ring: local background paper reflectance estimation
      if (distSq >= ringInnerRadiusSq && distSq <= ringOuterRadiusSq) {
        ringSum += val;
        ringCount++;
      }
    }
  }

  const innerCount = innerValues.length;
  const innerMean = innerCount > 0 ? innerSum / innerCount : 255.0;
  const ringMean = ringCount > 0 ? ringSum / ringCount : 255.0;

  // 3. Calculate P10, P20, P30 percentiles of inner core values
  let p10 = 255.0;
  let p20 = 255.0;
  let p30 = 255.0;
  if (innerCount > 0) {
    innerValues.sort((a, b) => a - b);
    p10 = innerValues[Math.floor(0.1 * (innerCount - 1))];
    p20 = innerValues[Math.floor(0.2 * (innerCount - 1))];
    p30 = innerValues[Math.floor(0.3 * (innerCount - 1))];
  }

  // 4. Relative Local Contrast: (Paper - Core) / Paper
  const safeRingMean = Math.max(1.0, ringMean);
  const contrast = Math.max(0.0, (ringMean - innerMean) / safeRingMean);

  // 5. Percentile Darkness: (Paper - P20) / Paper
  const percentileDarkness = Math.max(0.0, (ringMean - p20) / safeRingMean);

  // 6. Adaptive Dark Pixel Threshold & Ratio
  const adaptiveThreshold = ringMean - Math.max(config.adaptiveOffsetMin, ringMean * config.adaptiveOffsetRatio);
  let darkPixels = 0;
  let sumDarkDX = 0;
  let sumDarkDY = 0;
  let sumDarkWeight = 0;

  // Grid for Connected Component Analysis on Inner Core
  const darkCoreGrid: boolean[][] = [];
  const gridDim = rInt * 2 + 1;
  for (let y = 0; y < gridDim; y++) {
    darkCoreGrid.push(new Array(gridDim).fill(false));
  }

  for (const p of innerPixels) {
    if (p.val < adaptiveThreshold) {
      darkPixels++;
      const w = adaptiveThreshold - p.val;
      sumDarkDX += p.dx * w;
      sumDarkDY += p.dy * w;
      sumDarkWeight += w;

      const gy = p.dy + rInt;
      const gx = p.dx + rInt;
      if (gy >= 0 && gy < gridDim && gx >= 0 && gx < gridDim) {
        darkCoreGrid[gy][gx] = true;
      }
    }
  }

  const darkRatio = innerCount > 0 ? darkPixels / innerCount : 0.0;
  const filledAreaRatio = innerCount > 0 ? darkPixels / innerCount : 0.0;

  // 7. Connected Component Analysis (8-way flood fill)
  let componentCount = 0;
  let largestComponentSize = 0;
  const visitedGrid: boolean[][] = Array.from({ length: gridDim }, () => new Array(gridDim).fill(false));

  for (let y = 0; y < gridDim; y++) {
    for (let x = 0; x < gridDim; x++) {
      if (darkCoreGrid[y][x] && !visitedGrid[y][x]) {
        componentCount++;
        let compSize = 0;
        const queue: [number, number][] = [[x, y]];
        visitedGrid[y][x] = true;

        while (queue.length > 0) {
          const [qx, qy] = queue.pop()!;
          compSize++;

          for (let ndy = -1; ndy <= 1; ndy++) {
            for (let ndx = -1; ndx <= 1; ndx++) {
              if (ndx === 0 && ndy === 0) continue;
              const nx = qx + ndx;
              const ny = qy + ndy;
              if (
                nx >= 0 &&
                nx < gridDim &&
                ny >= 0 &&
                ny < gridDim &&
                darkCoreGrid[ny][nx] &&
                !visitedGrid[ny][nx]
              ) {
                visitedGrid[ny][nx] = true;
                queue.push([nx, ny]);
              }
            }
          }
        }

        if (compSize > largestComponentSize) {
          largestComponentSize = compSize;
        }
      }
    }
  }

  const largestComponentRatio = innerCount > 0 ? largestComponentSize / innerCount : 0.0;

  // 8. Centroid Mass Offset and Dispersion
  let centroidOffset = 0.0;
  let centroidScore = 1.0;
  if (sumDarkWeight > 0) {
    const darkCentroidDX = sumDarkDX / sumDarkWeight;
    const darkCentroidDY = sumDarkDY / sumDarkWeight;
    centroidOffset = Math.sqrt(darkCentroidDX * darkCentroidDX + darkCentroidDY * darkCentroidDY);
    // Normalized score: 1.0 at center, drops to 0.2 at outer boundary
    centroidScore = Math.max(0.1, 1.0 - centroidOffset / (innerRadius || 1.0));
  } else {
    centroidScore = 0.5;
  }

  // 9. Template Difference (deviation against white paper baseline ring)
  const templateDifference = Math.max(0.0, Math.min(1.0, (ringMean - p10) / safeRingMean));

  // 10. Weighted Composite Bubble Score
  const score =
    config.contrastWeight * contrast +
    config.darkRatioWeight * darkRatio +
    config.percentileWeight * percentileDarkness;

  const filled = score >= config.minScore;

  return {
    cx,
    cy,
    expectedX,
    expectedY,
    radius,
    innerMean: Math.round(innerMean * 10) / 10,
    ringMean: Math.round(ringMean * 10) / 10,
    p10: Math.round(p10 * 10) / 10,
    p20: Math.round(p20 * 10) / 10,
    p30: Math.round(p30 * 10) / 10,
    darkRatio: Math.round(darkRatio * 1000) / 1000,
    contrast: Math.round(contrast * 1000) / 1000,
    percentileDarkness: Math.round(percentileDarkness * 1000) / 1000,
    filledAreaRatio: Math.round(filledAreaRatio * 1000) / 1000,
    largestComponentRatio: Math.round(largestComponentRatio * 1000) / 1000,
    componentCount,
    centroidOffset: Math.round(centroidOffset * 100) / 100,
    centroidScore: Math.round(centroidScore * 1000) / 1000,
    templateDifference: Math.round(templateDifference * 1000) / 1000,
    score: Math.round(score * 1000) / 1000,
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
  const margin = Math.round((bestScore - secondScore) * 1000) / 1000;

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

  confidence = Math.round(confidence * 100) / 100;

  const metricsMap: Record<"A" | "B" | "C" | "D", BubbleMetric> = {} as any;
  const choicesLog: Record<"A" | "B" | "C" | "D", BubbleChoiceRecord> = {} as any;

  measurements.forEach((m) => {
    metricsMap[m.option] = m.metric;
    const features: BubbleFeatures = {
      innerMean: m.metric.innerMean,
      ringMean: m.metric.ringMean,
      contrast: m.metric.contrast,
      p10: m.metric.p10,
      p20: m.metric.p20,
      p30: m.metric.p30,
      darkRatio: m.metric.darkRatio,
      filledAreaRatio: m.metric.filledAreaRatio,
      largestComponentRatio: m.metric.largestComponentRatio,
      componentCount: m.metric.componentCount,
      centroidOffset: m.metric.centroidOffset,
      centroidScore: m.metric.centroidScore,
      templateDifference: m.metric.templateDifference,
      finalScore: m.metric.score,
    };

    const geometry: BubbleGeometry = {
      expectedX: m.metric.expectedX,
      expectedY: m.metric.expectedY,
      actualX: m.metric.cx,
      actualY: m.metric.cy,
      radius: m.metric.radius,
      offsetX: m.metric.cx - m.metric.expectedX,
      offsetY: m.metric.cy - m.metric.expectedY,
    };

    choicesLog[m.option] = {
      score: m.metric.score,
      features,
      geometry,
    };
  });

  const diagnosticLog: QuestionDiagnosticLog = {
    question: questionNum,
    predicted: answer,
    confidence,
    bestScore,
    secondScore,
    margin,
    blank: isBlank,
    multiple: isMultiple,
    ambiguous: isAmbiguous,
    choices: choicesLog,
  };

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
    diagnosticLog,
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
  const margin = Math.round((bestScore - secondScore) * 1000) / 1000;

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

  confidence = Math.round(confidence * 100) / 100;

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

