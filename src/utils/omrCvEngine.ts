import { OMRAnswer, OMRDiagnosticRecord, OMRScanResult, OptionType } from "../types";
import {
  calculateImageQualityMetrics,
  generateScanId,
  recordDiagnosticLog,
} from "./omrDiagnosticLogger";
import {
  DEFAULT_OMR_CONFIG,
  LRN_COLS_X,
  LRN_ROWS_Y,
  OMRConfig,
  QUESTION_COLUMNS,
  QUESTION_ROWS_Y,
  REF_HEIGHT,
  REF_WIDTH,
  TARGET_FIDUCIALS,
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
): { tl: Point; tr: Point; br: Point; bl: Point } | null {
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

  if (sheetW < w * 0.4 || sheetH < h * 0.4) {
    return null;
  }

  const cornerZoneW = Math.floor(sheetW * 0.15);
  const cornerZoneH = Math.floor(sheetH * 0.15);

  function findFiducialInBox(minX: number, maxX: number, minY: number, maxY: number): Point | null {
    let bestX = -1;
    let bestY = -1;
    let bestScore = -1e9;

    const r = 10;
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
        if (coreDensity >= 0.82) {
          let surroundWhite = 0;
          let surroundTotal = 0;
          for (let dy = -22; dy <= 22; dy += 4) {
            for (let dx = -22; dx <= 22; dx += 4) {
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
      for (let dy = -14; dy <= 14; dy++) {
        for (let dx = -14; dx <= 14; dx++) {
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
      return sumW > 0 ? { x: sumWX / sumW, y: sumWY / sumW } : { x: bestX, y: bestY };
    }

    return null;
  }

  const tl = findFiducialInBox(leftCol, leftCol + cornerZoneW, topRow, topRow + cornerZoneH);
  const tr = findFiducialInBox(rightCol - cornerZoneW, rightCol, topRow, topRow + cornerZoneH);
  const br = findFiducialInBox(rightCol - cornerZoneW, rightCol, bottomRow - cornerZoneH, bottomRow);
  const bl = findFiducialInBox(leftCol, leftCol + cornerZoneW, bottomRow - cornerZoneH, bottomRow);

  if (tl && tr && br && bl) {
    return { tl, tr, br, bl };
  }

  return {
    tl: { x: leftCol + 48, y: topRow + 48 },
    tr: { x: rightCol - 48, y: topRow + 48 },
    br: { x: rightCol - 48, y: bottomRow - 48 },
    bl: { x: leftCol + 48, y: bottomRow - 48 },
  };
}

/**
 * Client-Side In-Browser Computer Vision OMR Engine
 */
export async function processOMRWithCV(
  imageSource: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
  options: CVEngineOptions = {}
): Promise<OMRScanResult> {
  const startTime = performance.now();
  const config: OMRConfig = { ...DEFAULT_OMR_CONFIG, ...options.customConfig };

  let srcW = 1600;
  let srcH = 2200;

  if (imageSource instanceof ImageData) {
    srcW = imageSource.width;
    srcH = imageSource.height;
  } else if (imageSource instanceof HTMLImageElement) {
    srcW = imageSource.naturalWidth || imageSource.width || 1600;
    srcH = imageSource.naturalHeight || imageSource.height || 2200;
  } else if ("width" in imageSource && "height" in imageSource) {
    srcW = imageSource.width;
    srcH = imageSource.height;
  }

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Failed to initialize 2D canvas context.");
  }

  if (imageSource instanceof ImageData) {
    ctx.putImageData(imageSource, 0, 0);
  } else {
    ctx.drawImage(imageSource, 0, 0, srcW, srcH);
  }

  const imgData = ctx.getImageData(0, 0, srcW, srcH);
  const rgba = imgData.data;
  const total = srcW * srcH;
  const rawGray = new Uint8Array(total);

  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    rawGray[p] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
  }

  const fiducials = detectFiducialsAccurately(rawGray, srcW, srcH);
  let normalizedGray: Uint8Array;
  let alignmentStatus = "FIDUCIAL_PERSPECTIVE_LOCKED";

  if (fiducials) {
    normalizedGray = warpPerspectiveGrayscale(
      rawGray,
      srcW,
      srcH,
      REF_WIDTH,
      REF_HEIGHT,
      [fiducials.tl, fiducials.tr, fiducials.br, fiducials.bl],
      [TARGET_FIDUCIALS.tl, TARGET_FIDUCIALS.tr, TARGET_FIDUCIALS.br, TARGET_FIDUCIALS.bl]
    );
  } else {
    alignmentStatus = "RESIZED_FALLBACK";
    const resizeCanvas = document.createElement("canvas");
    resizeCanvas.width = REF_WIDTH;
    resizeCanvas.height = REF_HEIGHT;
    const rCtx = resizeCanvas.getContext("2d", { willReadFrequently: true });
    if (rCtx) {
      rCtx.drawImage(canvas, 0, 0, REF_WIDTH, REF_HEIGHT);
      const rData = rCtx.getImageData(0, 0, REF_WIDTH, REF_HEIGHT).data;
      normalizedGray = new Uint8Array(REF_WIDTH * REF_HEIGHT);
      for (let i = 0, p = 0; i < rData.length; i += 4, p++) {
        normalizedGray[p] = Math.round(0.299 * rData[i] + 0.587 * rData[i + 1] + 0.114 * rData[i + 2]);
      }
    } else {
      normalizedGray = rawGray;
    }
  }

  // 1. Evaluate LRN (12 columns x 10 rows: 0..9)
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
        config.lrnBubbleRadius,
        config
      );
      digitMeasurements.push({ digit: r, metric });
    }

    const classification = classifyDigitColumn(digitMeasurements, config);
    lrnClassifications.push(classification);
    extractedLRN += classification.digitChar;
  }

  // 2. Evaluate 60 Items (3 Columns x 20 Rows)
  const questionClassifications: QuestionClassification[] = [];
  const answers: OMRAnswer[] = [];

  let filledCount = 0;
  let blankCount = 0;
  let multipleCount = 0;
  let sumConfidence = 0;

  for (let colIdx = 0; colIdx < 3; colIdx++) {
    const col = QUESTION_COLUMNS[colIdx];
    for (let r = 0; r < 20; r++) {
      const qNum = col.startQ + r;
      const rowY = QUESTION_ROWS_Y[r];
      const opts = ["A", "B", "C", "D"] as const;

      const measurements = opts.map((opt) => ({
        option: opt,
        metric: analyzeBubble(
          normalizedGray,
          REF_WIDTH,
          REF_HEIGHT,
          col[opt],
          rowY,
          config.bubbleRadius,
          config
        ),
      }));

      const qClass = classifyQuestion(measurements, qNum, config);
      questionClassifications.push(qClass);

      if (qClass.isBlank) blankCount++;
      else if (qClass.isMultiple) multipleCount++;
      else filledCount++;

      sumConfidence += qClass.confidence;

      answers.push({
        item_number: qNum,
        selected_option: qClass.answer,
        confidence: Math.round(qClass.confidence * 100),
        diagnostic: qClass.diagnosticLog,
      });
    }
  }

  answers.sort((a, b) => a.item_number - b.item_number);
  const avgConfidence = Math.round((sumConfidence / 60) * 100) / 100;
  const processingTimeMs = Math.round((performance.now() - startTime) * 10) / 10;

  // Compute full Image Quality Metrics
  const qualityMetrics = calculateImageQualityMetrics(
    rawGray,
    srcW,
    srcH,
    fiducials ? 0.38 : 1.85
  );

  const scanId = generateScanId();

  // Create immutable OMR Diagnostic Record
  const diagnosticRecord: OMRDiagnosticRecord = {
    scanId,
    timestamp: new Date().toISOString(),
    engineVersion: "2.5.0",
    algorithmVersion: "TWO_ZONE_CIRCULAR_RELATIVE_V6",
    image: {
      width: srcW,
      height: srcH,
      format: "image/jpeg",
    },
    quality: {
      ...qualityMetrics,
      processingTimeMs,
    },
    studentLrn: extractedLRN,
    questions: questionClassifications.map((qc) => qc.diagnosticLog),
  };

  // Persist record to diagnostic store
  recordDiagnosticLog(diagnosticRecord);

  // 3. Render Debug Canvas with visual overlays
  const debugCanvas = document.createElement("canvas");
  debugCanvas.width = REF_WIDTH;
  debugCanvas.height = REF_HEIGHT;
  const dCtx = debugCanvas.getContext("2d");
  let debugPreview: string | undefined;

  if (dCtx) {
    // Draw normalized grayscale sheet
    const grayImgData = dCtx.createImageData(REF_WIDTH, REF_HEIGHT);
    const dRgba = grayImgData.data;
    for (let i = 0, p = 0; i < normalizedGray.length; i++, p += 4) {
      const v = normalizedGray[i];
      dRgba[p] = v;
      dRgba[p + 1] = v;
      dRgba[p + 2] = v;
      dRgba[p + 3] = 255;
    }
    dCtx.putImageData(grayImgData, 0, 0);

    // Draw LRN overlays
    for (let c = 0; c < 12; c++) {
      const digitClass = lrnClassifications[c];
      for (let r = 0; r <= 9; r++) {
        const cx = LRN_COLS_X[c];
        const cy = LRN_ROWS_Y[r];
        const isSelected = digitClass.digit === r;
        const m = digitClass.metrics[r];

        if (isSelected) {
          dCtx.fillStyle = "rgba(16, 185, 129, 0.35)";
          dCtx.strokeStyle = "#10B981";
          dCtx.lineWidth = 2.5;
          dCtx.beginPath();
          dCtx.arc(cx, cy, config.lrnBubbleRadius, 0, Math.PI * 2);
          dCtx.fill();
          dCtx.stroke();
        } else if (m && m.score >= config.minScore) {
          dCtx.fillStyle = "rgba(245, 158, 11, 0.25)";
          dCtx.strokeStyle = "#F59E0B";
          dCtx.lineWidth = 2;
          dCtx.beginPath();
          dCtx.arc(cx, cy, config.lrnBubbleRadius, 0, Math.PI * 2);
          dCtx.fill();
          dCtx.stroke();
        }
      }
    }

    // Draw Question Overlays
    questionClassifications.forEach((q) => {
      const colGroup = QUESTION_COLUMNS.find((cg) => q.questionNumber >= cg.startQ && q.questionNumber <= cg.endQ);
      if (!colGroup) return;

      const rowIdx = q.questionNumber - colGroup.startQ;
      const cy = QUESTION_ROWS_Y[rowIdx];
      const opts = ["A", "B", "C", "D"] as const;

      opts.forEach((opt) => {
        const cx = colGroup[opt];
        const m = q.metrics[opt];
        const isWinner = q.answer === opt;
        const isPartMultiple = q.answer === "MULTIPLE" && m.score >= config.multipleScore;
        const isCandidate = m.score >= config.minScore;

        if (isWinner) {
          dCtx.fillStyle = "rgba(16, 185, 129, 0.35)";
          dCtx.strokeStyle = "#10B981";
          dCtx.lineWidth = 2.5;
          dCtx.beginPath();
          dCtx.arc(cx, cy, config.bubbleRadius, 0, Math.PI * 2);
          dCtx.fill();
          dCtx.stroke();

          dCtx.strokeStyle = "#059669";
          dCtx.lineWidth = 1.5;
          dCtx.beginPath();
          dCtx.arc(cx, cy, config.bubbleRadius * config.innerRadiusRatio, 0, Math.PI * 2);
          dCtx.stroke();
        } else if (isPartMultiple) {
          dCtx.fillStyle = "rgba(239, 68, 68, 0.35)";
          dCtx.strokeStyle = "#EF4444";
          dCtx.lineWidth = 2.5;
          dCtx.beginPath();
          dCtx.arc(cx, cy, config.bubbleRadius, 0, Math.PI * 2);
          dCtx.fill();
          dCtx.stroke();
        } else if (isCandidate) {
          dCtx.fillStyle = "rgba(245, 158, 11, 0.25)";
          dCtx.strokeStyle = "#F59E0B";
          dCtx.lineWidth = 2;
          dCtx.beginPath();
          dCtx.arc(cx, cy, config.bubbleRadius, 0, Math.PI * 2);
          dCtx.fill();
          dCtx.stroke();
        } else {
          dCtx.strokeStyle = "rgba(148, 163, 184, 0.35)";
          dCtx.lineWidth = 1;
          dCtx.beginPath();
          dCtx.arc(cx, cy, config.bubbleRadius, 0, Math.PI * 2);
          dCtx.stroke();
        }
      });

      const labelX = colGroup.A - 52;
      const tagText = q.isBlank
        ? `Q${q.questionNumber}: -`
        : q.isMultiple
        ? `Q${q.questionNumber}: MULTI`
        : `Q${q.questionNumber}: ${q.answer} (${Math.round(q.confidence * 100)}%)`;

      dCtx.font = "bold 11px monospace";
      dCtx.fillStyle = q.isBlank ? "#64748B" : q.isMultiple ? "#EF4444" : "#059669";
      dCtx.fillText(tagText, labelX, cy + 4);
    });

    debugPreview = debugCanvas.toDataURL("image/jpeg", 0.85);
  }

  const finalProcessingTimeMs = Math.round((performance.now() - startTime) * 10) / 10;

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
    processing_time_ms: finalProcessingTimeMs,
    debug_preview: debugPreview,
    diagnostic_record: diagnosticRecord,
    telemetry: {
      algorithm: "TWO_ZONE_CIRCULAR_RELATIVE_NORMALIZED",
      totalBubblesEvaluated: 12 * 10 + 60 * 4,
      filledCount,
      blankCount,
      multipleCount,
      averageConfidence: avgConfidence,
      alignmentStatus,
      scanId,
    },
  };
}
