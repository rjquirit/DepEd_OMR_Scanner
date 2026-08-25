import sharp from "sharp";

interface Point {
  x: number;
  y: number;
}

interface BubbleMeasurement {
  x: number;
  y: number;
  meanGray: number;
  innerMeanGray: number;
  fillRatio: number;
  darkness: number;
  innerDarkness: number;
  score: number;
}

// Compute 3x3 perspective homography matrix mapping (dstX, dstY) -> (srcX, srcY)
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

// Warp source grayscale buffer to destination (W x H) using inverse homography
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

// Detect corner fiducials and sheet boundary
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

export async function processOMRImageWithCV(imageBuffer: Buffer) {
  const startTime = Date.now();
  const REF_WIDTH = 1467;
  const REF_HEIGHT = 2048;

  // 1. Initial Grayscale load via Sharp C++
  const { data: rawGray, info } = await sharp(imageBuffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const srcW = info.width;
  const srcH = info.height;

  // 2. Corner Fiducial Alignment & Perspective Warping
  const fiducials = detectFiducialsAccurately(rawGray, srcW, srcH);
  let normalizedGray: Uint8Array;

  // Exact reference fiducial centers in 1467 x 2048 coordinate space
  const targetTL: Point = { x: 110, y: 252 };
  const targetTR: Point = { x: 1355, y: 252 };
  const targetBR: Point = { x: 1355, y: 1928 };
  const targetBL: Point = { x: 110, y: 1928 };

  if (fiducials) {
    normalizedGray = warpPerspectiveGrayscale(
      rawGray,
      srcW,
      srcH,
      REF_WIDTH,
      REF_HEIGHT,
      [fiducials.tl, fiducials.tr, fiducials.br, fiducials.bl],
      [targetTL, targetTR, targetBR, targetBL]
    );
  } else {
    const { data: resized } = await sharp(imageBuffer)
      .resize(REF_WIDTH, REF_HEIGHT, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    normalizedGray = resized;
  }

  // 3. Contrast & Darkness Normalization
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < REF_WIDTH * REF_HEIGHT; i++) {
    const v = normalizedGray[i];
    if (v < minLum) minLum = v;
    if (v > maxLum) maxLum = v;
  }
  const range = maxLum - minLum || 1;
  const contrastStretched = new Uint8Array(REF_WIDTH * REF_HEIGHT);
  for (let i = 0; i < REF_WIDTH * REF_HEIGHT; i++) {
    contrastStretched[i] = Math.round(((normalizedGray[i] - minLum) / range) * 255);
  }

  // 4. Optical Density Evaluator using Circular Kernel with local centroid peak search
  function evaluateBubble(expectedX: number, expectedY: number, radius = 10): BubbleMeasurement {
    // Local peak search within +/- 6px for centroid registration
    let bestX = expectedX;
    let bestY = expectedY;
    let minCoreGray = 255;

    for (let dy = -6; dy <= 6; dy += 2) {
      for (let dx = -6; dx <= 6; dx += 2) {
        const cx = expectedX + dx;
        const cy = expectedY + dy;
        let sum = 0;
        let cnt = 0;
        for (let iy = -3; iy <= 3; iy++) {
          for (let ix = -3; ix <= 3; ix++) {
            const px = cx + ix;
            const py = cy + iy;
            if (px >= 0 && px < REF_WIDTH && py >= 0 && py < REF_HEIGHT) {
              sum += contrastStretched[py * REF_WIDTH + px];
              cnt++;
            }
          }
        }
        const avg = cnt > 0 ? sum / cnt : 255;
        if (avg < minCoreGray) {
          minCoreGray = avg;
          bestX = cx;
          bestY = cy;
        }
      }
    }

    let sumGray = 0;
    let sumInnerGray = 0;
    let totalPixels = 0;
    let innerPixels = 0;
    let darkPixels = 0;

    const rInt = Math.ceil(radius);
    const rSq = radius * radius;
    const innerRSq = (radius * 0.55) * (radius * 0.55);

    for (let dy = -rInt; dy <= rInt; dy++) {
      for (let dx = -rInt; dx <= rInt; dx++) {
        const dSq = dx * dx + dy * dy;
        if (dSq <= rSq) {
          const px = Math.round(bestX + dx);
          const py = Math.round(bestY + dy);
          if (px >= 0 && px < REF_WIDTH && py >= 0 && py < REF_HEIGHT) {
            const val = contrastStretched[py * REF_WIDTH + px];
            sumGray += val;
            totalPixels++;
            if (val < 140) darkPixels++;

            if (dSq <= innerRSq) {
              sumInnerGray += val;
              innerPixels++;
            }
          }
        }
      }
    }

    const meanGray = totalPixels > 0 ? sumGray / totalPixels : 255;
    const innerMeanGray = innerPixels > 0 ? sumInnerGray / innerPixels : 255;
    const fillRatio = totalPixels > 0 ? darkPixels / totalPixels : 0;
    const darkness = 1 - meanGray / 255;
    const innerDarkness = 1 - innerMeanGray / 255;
    const score = darkness * 0.35 + innerDarkness * 0.65;

    return {
      x: bestX,
      y: bestY,
      meanGray,
      innerMeanGray,
      fillRatio,
      darkness,
      innerDarkness,
      score,
    };
  }

  // 5. LRN Extraction (12 columns x 10 rows: 0..9)
  const lrnColsX = [322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760];
  const lrnRowsY = [428, 473, 518, 563, 608, 653, 697, 738, 783, 828];

  let extractedLRN = "";
  for (let c = 0; c < 12; c++) {
    const colScores: { digit: number; score: number; mean: number }[] = [];
    for (let r = 0; r <= 9; r++) {
      const m = evaluateBubble(lrnColsX[c], lrnRowsY[r], 9);
      colScores.push({ digit: r, score: m.score, mean: m.meanGray });
    }
    colScores.sort((a, b) => b.score - a.score);
    const top = colScores[0];
    const second = colScores[1];

    if (top.score >= 0.38 && top.mean <= 165) {
      if (second && second.score >= 0.38 && second.score / top.score >= 0.85) {
        extractedLRN += "?";
      } else {
        extractedLRN += top.digit.toString();
      }
    } else {
      extractedLRN += "?";
    }
  }

  // 6. Answers Extraction (3 Columns of 20 Items = 60 Questions)
  const qCols3 = [
    { startQ: 1, A: 392, B: 436, C: 480, D: 524 },
    { startQ: 21, A: 673, B: 717, C: 761, D: 807 },
    { startQ: 41, A: 951, B: 997, C: 1041, D: 1087 },
  ];
  const qRows3Y = [
    947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386,
    1464, 1514, 1563, 1611, 1659, 1708, 1757, 1806, 1854, 1903,
  ];

  const optionsList = ["A", "B", "C", "D"] as const;
  const answers = [];

  for (let colIdx = 0; colIdx < 3; colIdx++) {
    const col = qCols3[colIdx];
    for (let r = 0; r < 20; r++) {
      const itemNum = col.startQ + r;
      const rowY = qRows3Y[r];

      const measurements = optionsList.map((opt) => {
        const bx = col[opt];
        const m = evaluateBubble(bx, rowY, 10);
        return { opt, ...m };
      });

      measurements.sort((a, b) => b.score - a.score);
      const first = measurements[0];
      const second = measurements[1];

      let selectedOption: "A" | "B" | "C" | "D" | "MULTIPLE" | null = null;
      let confidence = 98;

      if (first.score >= 0.38 && first.meanGray <= 165) {
        if (second && second.score >= 0.38 && second.score / first.score >= 0.85) {
          selectedOption = "MULTIPLE";
          confidence = 90;
        } else {
          selectedOption = first.opt;
          confidence = Math.min(99, Math.round(75 + first.score * 30));
        }
      } else {
        selectedOption = null;
        confidence = 98;
      }

      answers.push({
        item_number: itemNum,
        selected_option: selectedOption,
        confidence,
      });
    }
  }

  answers.sort((a, b) => a.item_number - b.item_number);

  const processingTimeMs = Date.now() - startTime;

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
  };
}
