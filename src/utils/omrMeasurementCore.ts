import { OMRConfig, DEFAULT_OMR_CONFIG } from "./omrConfig";
import {
  BubbleChoiceRecord,
  BubbleFeatures,
  BubbleGeometry,
  BubbleResult,
  OptionType,
  QuestionDiagnosticLog,
} from "../types";

export interface MaskPoint {
  dx: number;
  dy: number;
  distSq: number;
}

// Precomputed circle masks cache keyed by radius
const circleMaskCache = new Map<string, { core: MaskPoint[]; ring: MaskPoint[]; paper: MaskPoint[] }>();

/**
 * Precomputes and caches discrete circular mask points for deterministic, high-speed execution
 */
export function getPrecomputedMasks(
  coreRadius: number,
  ringInnerRadius: number,
  ringOuterRadius: number,
  paperInnerRadius: number = 0,
  paperOuterRadius: number = 0
) {
  const key = `${coreRadius}_${ringInnerRadius}_${ringOuterRadius}_${paperInnerRadius}_${paperOuterRadius}`;
  if (circleMaskCache.has(key)) {
    return circleMaskCache.get(key)!;
  }

  const core: MaskPoint[] = [];
  const ring: MaskPoint[] = [];
  const paper: MaskPoint[] = [];

  const maxR = Math.ceil(Math.max(ringOuterRadius, paperOuterRadius || ringOuterRadius));
  const coreRSq = coreRadius * coreRadius;
  const ringInSq = ringInnerRadius * ringInnerRadius;
  const ringOutSq = ringOuterRadius * ringOuterRadius;
  const paperInSq = paperInnerRadius * paperInnerRadius;
  const paperOutSq = paperOuterRadius * paperOuterRadius;

  for (let dy = -maxR; dy <= maxR; dy++) {
    const dySq = dy * dy;
    for (let dx = -maxR; dx <= maxR; dx++) {
      const distSq = dx * dx + dySq;

      if (distSq <= coreRSq) {
        core.push({ dx, dy, distSq });
      }

      if (distSq >= ringInSq && distSq <= ringOutSq) {
        ring.push({ dx, dy, distSq });
      }

      if (paperOuterRadius > 0 && distSq >= paperInSq && distSq <= paperOutSq) {
        paper.push({ dx, dy, distSq });
      }
    }
  }

  const result = { core, ring, paper };
  circleMaskCache.set(key, result);
  return result;
}

export interface BubbleMetric extends BubbleFeatures, BubbleGeometry {
  cx: number;
  cy: number;
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
  status: "CLEAR" | "BLANK" | "MULTIPLE" | "AMBIGUOUS";
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
 * Constrained Local Center Refinement:
 * Evaluates candidate centers within search window by circular shaded convolution response
 */
export function refineBubbleCenter(
  gray: Uint8Array,
  width: number,
  height: number,
  expectedX: number,
  expectedY: number,
  coreRadius: number,
  searchRadius: number,
  maxOffset: number
): { actualX: number; actualY: number; offsetX: number; offsetY: number } {
  let bestX = expectedX;
  let bestY = expectedY;
  let bestShadingScore = -1e9;

  const smallCoreR = Math.max(3, Math.floor(coreRadius * 0.7));
  const smallCoreRSq = smallCoreR * smallCoreR;

  // Evaluate candidate offsets
  for (let sdy = -searchRadius; sdy <= searchRadius; sdy++) {
    const cy = expectedY + sdy;
    if (cy < coreRadius || cy >= height - coreRadius) continue;

    for (let sdx = -searchRadius; sdx <= searchRadius; sdx++) {
      const distFromExpected = Math.sqrt(sdx * sdx + sdy * sdy);
      if (distFromExpected > maxOffset) continue;

      const cx = expectedX + sdx;
      if (cx < coreRadius || cx >= width - coreRadius) continue;

      // Measure local circular darkness response
      let sum = 0;
      let count = 0;
      for (let dy = -smallCoreR; dy <= smallCoreR; dy++) {
        const row = (cy + dy) * width;
        const dySq = dy * dy;
        for (let dx = -smallCoreR; dx <= smallCoreR; dx++) {
          if (dx * dx + dySq <= smallCoreRSq) {
            sum += 255 - gray[row + cx + dx];
            count++;
          }
        }
      }

      const score = count > 0 ? sum / count : 0;
      // Slight penalty for distance from expected template anchor
      const penalizedScore = score - distFromExpected * 1.5;

      if (penalizedScore > bestShadingScore) {
        bestShadingScore = score;
        bestX = cx;
        bestY = cy;
      }
    }
  }

  // Only apply offset if there is an actual mark (darkness response > 35)
  if (bestShadingScore > 35) {
    const offX = bestX - expectedX;
    const offY = bestY - expectedY;
    return { actualX: bestX, actualY: bestY, offsetX: offX, offsetY: offY };
  }

  return { actualX: expectedX, actualY: expectedY, offsetX: 0, offsetY: 0 };
}

/**
 * Multi-Zone Bubble Measurement with Rich Feature Extraction & Precomputed Masks
 */
export function analyzeBubble(
  gray: Uint8Array,
  width: number,
  height: number,
  expectedX: number,
  expectedY: number,
  coreRadius: number = DEFAULT_OMR_CONFIG.questionCoreRadius,
  ringInnerRadius: number = DEFAULT_OMR_CONFIG.questionRingInnerRadius,
  ringOuterRadius: number = DEFAULT_OMR_CONFIG.questionRingOuterRadius,
  config: OMRConfig = DEFAULT_OMR_CONFIG,
  paperInnerRadius: number = DEFAULT_OMR_CONFIG.questionPaperRingInnerRadius,
  paperOuterRadius: number = DEFAULT_OMR_CONFIG.questionPaperRingOuterRadius
): BubbleMetric {
  // 1. Constrained Center Refinement
  const { actualX, actualY, offsetX, offsetY } = refineBubbleCenter(
    gray,
    width,
    height,
    expectedX,
    expectedY,
    coreRadius,
    config.centerSearchRadiusPx,
    config.maxCenterOffsetPx
  );

  const cx = actualX;
  const cy = actualY;

  // 2. Retrieve Precomputed Circle Masks
  const { core, ring, paper } = getPrecomputedMasks(
    coreRadius,
    ringInnerRadius,
    ringOuterRadius,
    paperInnerRadius,
    paperOuterRadius
  );

  let innerSum = 0;
  const innerValues: number[] = [];
  const innerCoords: { dx: number; dy: number; val: number }[] = [];

  for (let i = 0; i < core.length; i++) {
    const px = cx + core[i].dx;
    const py = cy + core[i].dy;
    if (px >= 0 && px < width && py >= 0 && py < height) {
      const val = gray[py * width + px];
      innerSum += val;
      innerValues.push(val);
      innerCoords.push({ dx: core[i].dx, dy: core[i].dy, val });
    }
  }

  let ringSum = 0;
  let ringCount = 0;
  for (let i = 0; i < ring.length; i++) {
    const px = cx + ring[i].dx;
    const py = cy + ring[i].dy;
    if (px >= 0 && px < width && py >= 0 && py < height) {
      ringSum += gray[py * width + px];
      ringCount++;
    }
  }

  let paperSum = 0;
  let paperCount = 0;
  for (let i = 0; i < paper.length; i++) {
    const px = cx + paper[i].dx;
    const py = cy + paper[i].dy;
    if (px >= 0 && px < width && py >= 0 && py < height) {
      paperSum += gray[py * width + px];
      paperCount++;
    }
  }

  const innerCount = innerValues.length;
  const coreMean = innerCount > 0 ? innerSum / innerCount : 255.0;
  const innerMean = coreMean;

  // Reference background paper luminance estimation (prefer clean outer paper annulus if present)
  let refPaperMean = paperCount > 0 ? paperSum / paperCount : (ringCount > 0 ? ringSum / ringCount : 255.0);
  const ringMean = ringCount > 0 ? ringSum / ringCount : refPaperMean;

  // Ensure reference background doesn't drop below ring
  if (refPaperMean < ringMean * 0.9) {
    refPaperMean = ringMean;
  }

  // 3. Percentiles of inner core values (P10, P20, P30)
  let p10 = 255.0;
  let p20 = 255.0;
  let p30 = 255.0;
  if (innerCount > 0) {
    innerValues.sort((a, b) => a - b);
    p10 = innerValues[Math.floor(0.10 * (innerCount - 1))];
    p20 = innerValues[Math.floor(0.20 * (innerCount - 1))];
    p30 = innerValues[Math.floor(0.30 * (innerCount - 1))];
  }

  // 4. Relative Local Contrast: (PaperRef - Core) / PaperRef
  const safePaperMean = Math.max(1.0, refPaperMean);
  const contrast = Math.max(0.0, Math.min(1.0, (refPaperMean - coreMean) / safePaperMean));

  // 5. Percentile Darkness: (PaperRef - P20) / PaperRef
  const percentileDarkness = Math.max(0.0, Math.min(1.0, (refPaperMean - p20) / safePaperMean));

  // 6. Adaptive Dark Pixel Threshold & Ratio
  const adaptiveThreshold = refPaperMean - Math.max(config.adaptiveOffsetMin, refPaperMean * config.adaptiveOffsetRatio);
  let darkPixels = 0;
  let sumDarkDX = 0;
  let sumDarkDY = 0;
  let sumDarkWeight = 0;

  const rInt = Math.ceil(coreRadius);
  const gridDim = rInt * 2 + 1;
  const darkCoreGrid: boolean[][] = Array.from({ length: gridDim }, () => new Array(gridDim).fill(false));

  for (let i = 0; i < innerCoords.length; i++) {
    const p = innerCoords[i];
    if (p.val < adaptiveThreshold) {
      darkPixels++;
      const w = adaptiveThreshold - p.val;
      sumDarkDX += p.dx * w;
      sumDarkDY += p.dy * w;
      sumDarkWeight += w;

      const gx = p.dx + rInt;
      const gy = p.dy + rInt;
      if (gx >= 0 && gx < gridDim && gy >= 0 && gy < gridDim) {
        darkCoreGrid[gy][gx] = true;
      }
    }
  }

  const darkRatio = innerCount > 0 ? darkPixels / innerCount : 0.0;
  const filledAreaRatio = darkRatio;

  // 7. 8-Connected Component Analysis
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
  const componentScore = componentCount === 1 ? largestComponentRatio : Math.max(0.0, largestComponentRatio * 0.85);

  // 8. Centroid Mass Offset and Dispersion Score
  let centroidOffset = 0.0;
  let centroidScore = 1.0;
  if (sumDarkWeight > 0) {
    const darkCentroidDX = sumDarkDX / sumDarkWeight;
    const darkCentroidDY = sumDarkDY / sumDarkWeight;
    centroidOffset = Math.sqrt(darkCentroidDX * darkCentroidDX + darkCentroidDY * darkCentroidDY);
    centroidScore = Math.max(0.1, 1.0 - centroidOffset / (coreRadius || 1.0));
  } else {
    centroidScore = 0.5;
  }

  // 9. Template Difference
  const templateDifference = Math.max(0.0, Math.min(1.0, (refPaperMean - p10) / safePaperMean));

  // 10. Multi-Feature Composite Bubble Score
  const score =
    config.contrastWeight * contrast +
    config.darkRatioWeight * darkRatio +
    config.percentileWeight * percentileDarkness +
    config.componentWeight * componentScore +
    config.centroidWeight * centroidScore;

  const clampedScore = Math.max(0.0, Math.min(1.0, score));
  const filled = clampedScore >= config.minFillScore;

  return {
    expectedX,
    expectedY,
    actualX,
    actualY,
    radius: ringOuterRadius,
    offsetX: Math.round(offsetX * 10) / 10,
    offsetY: Math.round(offsetY * 10) / 10,
    cx,
    cy,
    coreMean: Math.round(coreMean * 10) / 10,
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
    score: Math.round(clampedScore * 1000) / 1000,
    finalScore: Math.round(clampedScore * 1000) / 1000,
    filled,
  };
}

/**
 * Question-Level Classifier (Evaluates A, B, C, D collectively)
 */
export function classifyQuestion(
  measurements: { option: "A" | "B" | "C" | "D"; metric: BubbleMetric }[],
  questionNum: number,
  config: OMRConfig = DEFAULT_OMR_CONFIG,
  imageQualityScore: number = 0.95
): QuestionClassification {
  const sorted = [...measurements].sort((a, b) => b.metric.score - a.metric.score);
  const first = sorted[0];
  const second = sorted[1];

  const bestScore = first.metric.score;
  const secondScore = second ? second.metric.score : 0.0;
  const margin = Math.round((bestScore - secondScore) * 1000) / 1000;

  // Relative statistical distribution across choices
  const allScores = measurements.map((m) => m.metric.score);
  const meanScore = allScores.reduce((acc, v) => acc + v, 0) / 4;
  const variance = allScores.reduce((acc, v) => acc + (v - meanScore) ** 2, 0) / 4;
  const stdDev = Math.sqrt(variance);
  const zScore = stdDev > 0.01 ? (bestScore - meanScore) / stdDev : 0.0;

  let isBlank = false;
  let isMultiple = false;
  let isAmbiguous = false;
  let answer: OptionType = null;
  let status: "CLEAR" | "BLANK" | "MULTIPLE" | "AMBIGUOUS" = "CLEAR";
  let confidence = 0.0;

  if (bestScore < config.minFillScore) {
    // 1. Blank Question: No bubble exceeds fill threshold
    isBlank = true;
    status = "BLANK";
    answer = null;
    confidence = Math.min(0.99, Math.max(0.85, 1.0 - bestScore));
  } else if (secondScore >= config.multipleScore && margin < config.minClassificationMargin) {
    // 2. Multiple Marks: Two or more distinct marks with high scores and narrow victory margin
    isMultiple = true;
    isAmbiguous = true;
    status = "MULTIPLE";
    answer = "MULTIPLE";
    confidence = Math.max(0.50, Math.min(0.92, 0.60 + (secondScore - config.multipleScore)));
  } else if (margin < config.minClassificationMargin) {
    // 3. Ambiguous: Top mark is above threshold, but runner up is too close to call safely
    isAmbiguous = true;
    status = "AMBIGUOUS";
    answer = "MULTIPLE";
    confidence = Math.max(0.40, Math.min(0.75, 0.50 + margin));
  } else {
    // 4. Clear Single Winner
    status = "CLEAR";
    answer = first.option;

    // Multi-factor confidence calibration
    const marginFactor = Math.min(1.0, margin / 0.40);
    const scoreFactor = Math.min(1.0, bestScore / 0.75);
    const zFactor = Math.min(1.0, zScore / 2.5);
    const centroidFactor = first.metric.centroidScore;

    const baseConfidence =
      0.40 * marginFactor +
      0.30 * scoreFactor +
      0.15 * zFactor +
      0.15 * centroidFactor;

    confidence = Math.min(0.99, Math.max(0.70, 0.50 + 0.49 * baseConfidence * imageQualityScore));
  }

  confidence = Math.round(confidence * 100) / 100;

  const metricsMap: Record<"A" | "B" | "C" | "D", BubbleMetric> = {} as any;
  const choicesLog: Record<"A" | "B" | "C" | "D", BubbleChoiceRecord> = {} as any;

  measurements.forEach((m) => {
    metricsMap[m.option] = m.metric;
    const features: BubbleFeatures = {
      coreMean: m.metric.coreMean,
      innerMean: m.metric.innerMean,
      ringMean: m.metric.ringMean,
      contrast: m.metric.contrast,
      percentileDarkness: m.metric.percentileDarkness,
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
      score: m.metric.score,
      finalScore: m.metric.score,
    };

    const geometry: BubbleGeometry = {
      expectedX: m.metric.expectedX,
      expectedY: m.metric.expectedY,
      actualX: m.metric.actualX,
      actualY: m.metric.actualY,
      radius: m.metric.radius,
      offsetX: m.metric.offsetX,
      offsetY: m.metric.offsetY,
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
    status,
    isBlank,
    isMultiple,
    isAmbiguous,
    metrics: metricsMap,
    diagnosticLog,
  };
}

/**
 * Digit Column Classifier (Evaluates Digits 0 to 9 for LRN)
 */
export function classifyDigitColumn(
  measurements: { digit: number; metric: BubbleMetric }[],
  config: OMRConfig = DEFAULT_OMR_CONFIG,
  imageQualityScore: number = 0.95
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

  if (bestScore < config.minFillScore) {
    isBlank = true;
    digitChar = "?";
    confidence = Math.min(0.99, Math.max(0.85, 1.0 - bestScore));
  } else if (secondScore >= config.multipleScore && margin < config.minClassificationMargin) {
    isMultiple = true;
    isAmbiguous = true;
    digitChar = "?";
    confidence = Math.max(0.50, Math.min(0.88, 0.60 + (secondScore - config.multipleScore)));
  } else if (margin < config.minClassificationMargin) {
    isAmbiguous = true;
    digitChar = "?";
    confidence = Math.max(0.40, Math.min(0.75, 0.50 + margin));
  } else {
    digit = first.digit;
    digitChar = first.digit.toString();
    const marginFactor = Math.min(1.0, margin / 0.40);
    const scoreFactor = Math.min(1.0, bestScore / 0.75);
    confidence = Math.min(0.99, Math.max(0.70, 0.50 + 0.49 * (0.6 * marginFactor + 0.4 * scoreFactor) * imageQualityScore));
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
