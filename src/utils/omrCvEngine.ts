import {
  AlignmentMetrics,
  OMRAnswer,
  OMRDiagnosticRecord,
  OMRScanResult,
} from "../types";
import {
  calculateImageQualityMetrics,
  generateScanId,
  recordDiagnosticLog,
} from "./omrDiagnosticLogger";
import {
  DEFAULT_OMR_CONFIG,
  LRN_COLS_X,
  LRN_ROWS_Y,
  OMR_ALGORITHM_NAME,
  OMR_ENGINE_VERSION,
  OMRConfig,
  QUESTION_BLOCKS,
  QUESTION_ROWS_Y,
  REF_HEIGHT,
  REF_WIDTH,
  TARGET_FIDUCIALS,
  getQuestionCoordinateDef,
} from "./omrConfig";
import {
  analyzeBubble,
  classifyDigitColumn,
  classifyQuestion,
  DigitClassification,
  QuestionClassification,
} from "./omrMeasurementCore";

export interface CVEngineOptions {
  customConfig?: Partial<OMRConfig>;
}

interface Point {
  x: number;
  y: number;
}

function getPerspectiveTransform(
  srcPts: [Point, Point, Point, Point],
  dstPts: [Point, Point, Point, Point]
): number[] {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const dx = dstPts[i].x;
    const dy = dstPts[i].y;
    const sx = srcPts[i].x;
    const sy = srcPts[i].y;

    a.push([dx, dy, 1, 0, 0, 0, -dx * sx, -dy * sx]);
    b.push(sx);

    a.push([0, 0, 0, dx, dy, 1, -dx * sy, -dy * sy]);
    b.push(sy);
  }

  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) {
        maxRow = k;
      }
    }
    [a[i], a[maxRow]] = [a[maxRow], a[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    const pivot = a[i][i];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let j = i; j < n; j++) a[i][j] /= pivot;
    b[i] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = a[k][i];
        for (let j = i; j < n; j++) {
          a[k][j] -= factor * a[i][j];
        }
        b[k] -= factor * b[i];
      }
    }
  }

  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1.0];
}

function calculateReprojectionErrors(
  srcPts: [Point, Point, Point, Point],
  dstPts: [Point, Point, Point, Point]
): { meanError: number; maxError: number; cornerErrors: { tl: number; tr: number; br: number; bl: number } } {
  const H = getPerspectiveTransform(srcPts, dstPts);
  const errors: number[] = [];

  for (let i = 0; i < 4; i++) {
    const dx = dstPts[i].x;
    const dy = dstPts[i].y;
    const denom = H[6] * dx + H[7] * dy + H[8];
    const reprojectedX = (H[0] * dx + H[1] * dy + H[2]) / denom;
    const reprojectedY = (H[3] * dx + H[4] * dy + H[5]) / denom;

    const actualX = srcPts[i].x;
    const actualY = srcPts[i].y;
    const err = Math.sqrt((reprojectedX - actualX) ** 2 + (reprojectedY - actualY) ** 2);
    errors.push(err);
  }

  const meanError = errors.reduce((a, b) => a + b, 0) / 4;
  const maxError = Math.max(...errors);

  return {
    meanError: Math.round(meanError * 100) / 100,
    maxError: Math.round(maxError * 100) / 100,
    cornerErrors: {
      tl: Math.round(errors[0] * 100) / 100,
      tr: Math.round(errors[1] * 100) / 100,
      br: Math.round(errors[2] * 100) / 100,
      bl: Math.round(errors[3] * 100) / 100,
    },
  };
}

function warpPerspectiveGrayscale(
  srcData: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  srcCorners: [Point, Point, Point, Point],
  dstCorners: [Point, Point, Point, Point]
): Uint8Array {
  const H = getPerspectiveTransform(srcCorners, dstCorners);
  const dst = new Uint8Array(dstW * dstH);

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const denom = H[6] * x + H[7] * y + H[8];
      const sx = (H[0] * x + H[1] * y + H[2]) / denom;
      const sy = (H[3] * x + H[4] * y + H[5]) / denom;

      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const wx = sx - x0;
        const wy = sy - y0;

        const val =
          srcData[y0 * srcW + x0] * (1 - wx) * (1 - wy) +
          srcData[y0 * srcW + x1] * wx * (1 - wy) +
          srcData[y1 * srcW + x0] * (1 - wx) * wy +
          srcData[y1 * srcW + x1] * wx * wy;

        dst[y * dstW + x] = Math.round(val);
      } else {
        dst[y * dstW + x] = 255;
      }
    }
  }

  return dst;
}

function detectFiducialsAccurately(
  gray: Uint8Array,
  w: number,
  h: number
): {
  detected: boolean;
  corners: { tl: Point; tr: Point; br: Point; bl: Point };
  confidence: number;
  sheetCoverage: number;
} {
  const total = w * h;
  const hist = new Int32Array(256);
  for (let i = 0; i < total; i++) hist[gray[i]]++;

  let maxCount = 0;
  let paperLevel = 240;
  for (let i = 180; i < 256; i++) {
    if (hist[i] > maxCount) {
      maxCount = hist[i];
      paperLevel = i;
    }
  }

  const darkThresh = Math.min(130, Math.floor(paperLevel * 0.55));
  const paperThresh = Math.max(160, Math.floor(paperLevel * 0.75));

  let topRow = 0;
  let bottomRow = h - 1;
  let leftCol = 0;
  let rightCol = w - 1;

  for (let y = 0; y < h; y++) {
    let paperCount = 0;
    for (let x = 0; x < w; x += 4) {
      if (gray[y * w + x] >= paperThresh) paperCount++;
    }
    if (paperCount > (w / 4) * 0.3) {
      topRow = y;
      break;
    }
  }

  for (let y = h - 1; y >= 0; y--) {
    let paperCount = 0;
    for (let x = 0; x < w; x += 4) {
      if (gray[y * w + x] >= paperThresh) paperCount++;
    }
    if (paperCount > (w / 4) * 0.3) {
      bottomRow = y;
      break;
    }
  }

  for (let x = 0; x < w; x++) {
    let paperCount = 0;
    for (let y = topRow; y <= bottomRow; y += 4) {
      if (gray[y * w + x] >= paperThresh) paperCount++;
    }
    if (paperCount > ((bottomRow - topRow) / 4) * 0.3) {
      leftCol = x;
      break;
    }
  }

  for (let x = w - 1; x >= 0; x--) {
    let paperCount = 0;
    for (let y = topRow; y <= bottomRow; y += 4) {
      if (gray[y * w + x] >= paperThresh) paperCount++;
    }
    if (paperCount > ((bottomRow - topRow) / 4) * 0.3) {
      rightCol = x;
      break;
    }
  }

  const sheetW = rightCol - leftCol;
  const sheetH = bottomRow - topRow;
  const sheetCoverage = Math.min(100, Math.max(10, ((sheetW * sheetH) / (w * h)) * 100));

  if (sheetW < w * 0.4 || sheetH < h * 0.4) {
    return {
      detected: false,
      corners: {
        tl: { x: 0, y: 0 },
        tr: { x: w - 1, y: 0 },
        br: { x: w - 1, y: h - 1 },
        bl: { x: 0, y: h - 1 },
      },
      confidence: 0.1,
      sheetCoverage,
    };
  }

  const cornerZoneW = Math.floor(sheetW * 0.18);
  const cornerZoneH = Math.floor(sheetH * 0.18);

  function findFiducialInBox(minX: number, maxX: number, minY: number, maxY: number): { pt: Point; conf: number } | null {
    let bestX = -1;
    let bestY = -1;
    let bestScore = -1e9;

    const r = 12;
    for (let y = minY + r + 2; y <= maxY - r - 2; y += 2) {
      for (let x = minX + r + 2; x <= maxX - r - 2; x += 2) {
        let coreDark = 0;
        let coreTotal = 0;
        for (let dy = -r; dy <= r; dy += 2) {
          for (let dx = -r; dx <= r; dx += 2) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              coreTotal++;
              if (gray[py * w + px] < darkThresh) {
                coreDark++;
              }
            }
          }
        }

        const coreDensity = coreTotal > 0 ? coreDark / coreTotal : 0;
        if (coreDensity >= 0.80) {
          let surroundWhite = 0;
          let surroundTotal = 0;
          for (let dy = -26; dy <= 26; dy += 4) {
            for (let dx = -26; dx <= 26; dx += 4) {
              if (Math.abs(dx) > r + 3 || Math.abs(dy) > r + 3) {
                const px = x + dx;
                const py = y + dy;
                if (px >= 0 && px < w && py >= 0 && py < h) {
                  surroundTotal++;
                  if (gray[py * w + px] > darkThresh) {
                    surroundWhite++;
                  }
                }
              }
            }
          }

          const surroundRatio = surroundTotal > 0 ? surroundWhite / surroundTotal : 0;
          const score = coreDensity * 2 + surroundRatio;
          if (score > bestScore) {
            bestScore = score;
            bestX = x;
            bestY = y;
          }
        }
      }
    }

    if (bestX > 0 && bestY > 0) {
      let sumWX = 0;
      let sumWY = 0;
      let sumW = 0;
      for (let dy = -16; dy <= 16; dy++) {
        for (let dx = -16; dx <= 16; dx++) {
          const px = bestX + dx;
          const py = bestY + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            if (gray[py * w + px] < darkThresh) {
              const weight = 255 - gray[py * w + px];
              sumWX += px * weight;
              sumWY += py * weight;
              sumW += weight;
            }
          }
        }
      }
      const pt = sumW > 0 ? { x: sumWX / sumW, y: sumWY / sumW } : { x: bestX, y: bestY };
      const conf = Math.min(0.99, Math.max(0.60, bestScore / 3.0));
      return { pt, conf };
    }

    return null;
  }

  const tl = findFiducialInBox(leftCol, leftCol + cornerZoneW, topRow, topRow + cornerZoneH);
  const tr = findFiducialInBox(rightCol - cornerZoneW, rightCol, topRow, topRow + cornerZoneH);
  const br = findFiducialInBox(rightCol - cornerZoneW, rightCol, bottomRow - cornerZoneH, bottomRow);
  const bl = findFiducialInBox(leftCol, leftCol + cornerZoneW, bottomRow - cornerZoneH, bottomRow);

  if (tl && tr && br && bl) {
    const avgConf = (tl.conf + tr.conf + br.conf + bl.conf) / 4;
    return {
      detected: true,
      corners: { tl: tl.pt, tr: tr.pt, br: br.pt, bl: bl.pt },
      confidence: Math.round(avgConf * 100) / 100,
      sheetCoverage,
    };
  }

  return {
    detected: false,
    corners: {
      tl: { x: leftCol + 48, y: topRow + 48 },
      tr: { x: rightCol - 48, y: topRow + 48 },
      br: { x: rightCol - 48, y: bottomRow - 48 },
      bl: { x: leftCol + 48, y: bottomRow - 48 },
    },
    confidence: 0.45,
    sheetCoverage,
  };
}

/**
 * Client-Side HTML5 Canvas CV Scanner Pipeline (Version 5.0)
 */
export async function runClientSideOMRScan(
  canvas: HTMLCanvasElement,
  options: CVEngineOptions = {}
): Promise<OMRScanResult> {
  const startTime = performance.now();
  const config: OMRConfig = { ...DEFAULT_OMR_CONFIG, ...options.customConfig };

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Failed to get 2D canvas context for OMR processing");

  const srcW = canvas.width;
  const srcH = canvas.height;
  const imgData = ctx.getImageData(0, 0, srcW, srcH);
  const srcData = imgData.data;

  // Convert RGBA to Grayscale
  const rawGray = new Uint8Array(srcW * srcH);
  for (let i = 0; i < srcW * srcH; i++) {
    const idx = i * 4;
    rawGray[i] = Math.round(0.299 * srcData[idx] + 0.587 * srcData[idx + 1] + 0.114 * srcData[idx + 2]);
  }

  // Detect Fiducials & Perspective Correction
  const fiducialResult = detectFiducialsAccurately(rawGray, srcW, srcH);
  let normalizedGray: Uint8Array;
  let alignmentStatus = "FIDUCIAL_PERSPECTIVE_LOCKED";
  let fallbackUsed = false;
  let alignmentValid = true;

  const targetCorners: [Point, Point, Point, Point] = [
    TARGET_FIDUCIALS.tl,
    TARGET_FIDUCIALS.tr,
    TARGET_FIDUCIALS.br,
    TARGET_FIDUCIALS.bl,
  ];

  const srcCorners: [Point, Point, Point, Point] = [
    fiducialResult.corners.tl,
    fiducialResult.corners.tr,
    fiducialResult.corners.br,
    fiducialResult.corners.bl,
  ];

  const reproj = calculateReprojectionErrors(srcCorners, targetCorners);

  if (fiducialResult.detected && reproj.maxError <= config.maxReprojectionErrorPx) {
    normalizedGray = warpPerspectiveGrayscale(
      rawGray,
      srcW,
      srcH,
      REF_WIDTH,
      REF_HEIGHT,
      srcCorners,
      targetCorners
    );
  } else if (fiducialResult.detected) {
    alignmentStatus = "ALIGNMENT_HIGH_ERROR";
    normalizedGray = warpPerspectiveGrayscale(
      rawGray,
      srcW,
      srcH,
      REF_WIDTH,
      REF_HEIGHT,
      srcCorners,
      targetCorners
    );
  } else {
    fallbackUsed = true;
    alignmentValid = false;
    alignmentStatus = "ALIGNMENT_UNCERTAIN_FALLBACK";

    // Client-side bilinear resize fallback
    normalizedGray = new Uint8Array(REF_WIDTH * REF_HEIGHT);
    const scaleX = srcW / REF_WIDTH;
    const scaleY = srcH / REF_HEIGHT;
    for (let y = 0; y < REF_HEIGHT; y++) {
      const sy = Math.min(srcH - 1, Math.floor(y * scaleY));
      for (let x = 0; x < REF_WIDTH; x++) {
        const sx = Math.min(srcW - 1, Math.floor(x * scaleX));
        normalizedGray[y * REF_WIDTH + x] = rawGray[sy * srcW + sx];
      }
    }
  }

  // Calculate True Image Quality Metrics
  const qualityMetrics = calculateImageQualityMetrics(
    rawGray,
    srcW,
    srcH,
    reproj.meanError,
    fiducialResult.confidence,
    fiducialResult.sheetCoverage
  );

  const imageQualityScore = Math.max(0.6, (qualityMetrics.sharpness / 100) * 0.5 + (qualityMetrics.illuminationUniformity / 100) * 0.5);

  // Evaluate LRN
  const lrnClassifications: DigitClassification[] = [];
  let extractedLRN = "";

  for (let c = 0; c < 12; c++) {
    const digitMeasurements = [];
    for (let r = 0; r <= 9; r++) {
      const metric = analyzeBubble(
        normalizedGray,
        REF_WIDTH,
        REF_HEIGHT,
        LRN_COLS_X[c],
        LRN_ROWS_Y[r],
        config.lrnCoreRadius,
        config.lrnRingInnerRadius,
        config.lrnRingOuterRadius,
        config
      );
      digitMeasurements.push({ digit: r, metric });
    }

    const classification = classifyDigitColumn(digitMeasurements, config, imageQualityScore);
    lrnClassifications.push(classification);
    extractedLRN += classification.digitChar;
  }

  // Evaluate 60 Items across 6 Section Blocks (3 Columns x Top & Bottom)
  const questionClassifications: QuestionClassification[] = [];
  const answers: OMRAnswer[] = [];

  let filledCount = 0;
  let blankCount = 0;
  let multipleCount = 0;
  let sumConfidence = 0;

  for (const block of QUESTION_BLOCKS) {
    for (let r = 0; r < 10; r++) {
      const qNum = block.startQ + r;
      const globalRowIdx = block.startRowIdx + r;
      const expRowY = QUESTION_ROWS_Y[globalRowIdx];
      const opts = ["A", "B", "C", "D"] as const;

      const measurements = opts.map((opt) => ({
        option: opt,
        metric: analyzeBubble(
          normalizedGray,
          REF_WIDTH,
          REF_HEIGHT,
          block[opt],
          expRowY,
          config.questionCoreRadius,
          config.questionRingInnerRadius,
          config.questionRingOuterRadius,
          config,
          config.questionPaperRingInnerRadius,
          config.questionPaperRingOuterRadius
        ),
      }));

      const qClass = classifyQuestion(measurements, qNum, config, imageQualityScore);
      questionClassifications.push(qClass);

      if (qClass.isBlank) blankCount++;
      else if (qClass.isMultiple) multipleCount++;
      else filledCount++;

      sumConfidence += qClass.confidence;

      answers.push({
        item_number: qNum,
        selected_option: qClass.answer,
        confidence: Math.round(qClass.confidence * 100),
        bestScore: qClass.bestScore,
        secondScore: qClass.secondScore,
        margin: qClass.margin,
        status: qClass.status,
        diagnostic: qClass.diagnosticLog,
      });
    }
  }

  answers.sort((a, b) => a.item_number - b.item_number);
  const avgConfidence = Math.round((sumConfidence / 60) * 100) / 100;
  const processingTimeMs = Math.round(performance.now() - startTime);
  const scanId = generateScanId();

  const alignmentMetrics: AlignmentMetrics = {
    valid: alignmentValid,
    fiducialsDetected: fiducialResult.detected ? 4 : 0,
    fiducialConfidence: fiducialResult.confidence,
    fallbackUsed,
    alignmentStatus,
    reprojectionErrorPx: reproj.meanError,
    maxReprojectionErrorPx: reproj.maxError,
    cornerErrors: reproj.cornerErrors,
  };

  let scanQuality: "GOOD" | "WARNING" | "REJECT" = "GOOD";
  if (!alignmentValid || reproj.maxError > config.maxReprojectionErrorPx * 1.5) {
    scanQuality = "REJECT";
  } else if (reproj.meanError > config.maxReprojectionErrorPx || qualityMetrics.sharpness < 40) {
    scanQuality = "WARNING";
  }

  const diagnosticRecord: OMRDiagnosticRecord = {
    scanId,
    timestamp: new Date().toISOString(),
    engineVersion: OMR_ENGINE_VERSION,
    algorithmVersion: OMR_ALGORITHM_NAME,
    image: {
      width: srcW,
      height: srcH,
      format: "image/jpeg",
    },
    alignment: alignmentMetrics,
    quality: {
      ...qualityMetrics,
      processingTimeMs,
    },
    studentLrn: extractedLRN,
    questions: questionClassifications.map((qc) => qc.diagnosticLog),
  };

  // Record Diagnostic log into local benchmark pool automatically
  recordDiagnosticLog(diagnosticRecord);

  // Generate Debug Canvas Overlay URL
  const debugCanvas = document.createElement("canvas");
  debugCanvas.width = REF_WIDTH;
  debugCanvas.height = REF_HEIGHT;
  const dctx = debugCanvas.getContext("2d");
  let debugPreviewUrl = "";

  if (dctx) {
    // Put normalized grayscale
    const dImgData = dctx.createImageData(REF_WIDTH, REF_HEIGHT);
    for (let i = 0; i < REF_WIDTH * REF_HEIGHT; i++) {
      const v = normalizedGray[i];
      const idx = i * 4;
      dImgData.data[idx] = v;
      dImgData.data[idx + 1] = v;
      dImgData.data[idx + 2] = v;
      dImgData.data[idx + 3] = 255;
    }
    dctx.putImageData(dImgData, 0, 0);

    // Draw diagnostic overlay
    dctx.lineWidth = 2;
    questionClassifications.forEach((q) => {
      const qCoord = getQuestionCoordinateDef(q.questionNumber);
      const expRowY = qCoord.y;
      const opts = ["A", "B", "C", "D"] as const;

      opts.forEach((opt) => {
        const m = q.metrics[opt];
        const cx = m ? m.actualX : qCoord[opt];
        const cy = m ? m.actualY : expRowY;

        if (q.answer === opt) {
          dctx.strokeStyle = "#10B981";
          dctx.fillStyle = "rgba(16, 185, 129, 0.35)";
          dctx.beginPath();
          dctx.arc(cx, cy, config.physicalBubbleRadius, 0, Math.PI * 2);
          dctx.fill();
          dctx.stroke();
        } else if (q.answer === "MULTIPLE" && m.score >= config.multipleScore) {
          dctx.strokeStyle = "#EF4444";
          dctx.fillStyle = "rgba(239, 68, 68, 0.35)";
          dctx.beginPath();
          dctx.arc(cx, cy, config.physicalBubbleRadius, 0, Math.PI * 2);
          dctx.fill();
          dctx.stroke();
        } else if (m.score >= config.minFillScore) {
          dctx.strokeStyle = "#F59E0B";
          dctx.fillStyle = "rgba(245, 158, 11, 0.25)";
          dctx.beginPath();
          dctx.arc(cx, cy, config.physicalBubbleRadius, 0, Math.PI * 2);
          dctx.fill();
          dctx.stroke();
        }
      });
    });

    debugPreviewUrl = debugCanvas.toDataURL("image/jpeg", 0.85);
  }

  return {
    student_lrn: extractedLRN,
    metadata: {
      name: null,
      section: null,
      school_id: null,
      grade_level: null,
      subject: null,
    },
    answers,
    scan_timestamp: new Date().toISOString(),
    processing_time_ms: processingTimeMs,
    debug_preview: debugPreviewUrl,
    diagnostic_record: diagnosticRecord,
    alignment: alignmentMetrics,
    telemetry: {
      algorithm: OMR_ALGORITHM_NAME,
      totalBubblesEvaluated: 12 * 10 + 60 * 4,
      filledCount,
      blankCount,
      multipleCount,
      averageConfidence: avgConfidence,
      alignmentStatus,
      scanId,
      scanQuality,
    },
  };
}

/**
 * Universal Client-Side Entrypoint for Canvas, Image Element, or Base64 string
 */
export async function processOMRWithCV(
  input: HTMLCanvasElement | HTMLImageElement | string,
  options: CVEngineOptions = {}
): Promise<OMRScanResult> {
  if (input instanceof HTMLCanvasElement) {
    return runClientSideOMRScan(input, options);
  }

  let img: HTMLImageElement;
  if (typeof input === "string") {
    img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = input;
    });
  } else {
    img = input;
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.drawImage(img, 0, 0);

  return runClientSideOMRScan(canvas, options);
}

