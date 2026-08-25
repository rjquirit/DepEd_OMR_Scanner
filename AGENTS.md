# AGENTS.md — Coding Agent & System Architecture Guide (Version 5.0)

> **Target Audience:** AI Coding Agents, Automated Maintainers, Computer Vision Engineers.
> **Scope:** DepEd Region X 60-Item OMR Scanner (Web Client, Server, C++ OpenCV, and Python CV Engines).

---

## 1. System Overview & Core Principles

The DepEd Region X OMR Scanner processes multiple-choice bubble answer sheets scanned or photographed under varying angles, distances, shadows, and pencil intensities.

### Core Non-Negotiables for Agents:
1. **Never use unconstrained darkest-pixel wandering** to detect bubble locations. Bubble coordinates are derived from the canonical template after 4-point homographic perspective correction with **Constrained Center Refinement** (within a tight $\pm 5\text{ px}$ search window evaluated by circular convolution response).
2. **Never classify bubbles using absolute grayscale thresholds** (e.g. `val < 130` or `intensity < 0.38`). The system uses a **Two-Zone Multi-Feature Circular Measurement Model** with precomputed discrete masks measuring inner graphite core contrast, percentile darkness ($P_{20}$), adaptive dark pixel ratio, 8-connected component coherence, and centroid mass alignment against local paper background.
3. **Always classify at the Question Level**, not individual bubbles. Options $A, B, C, D$ for each question must be jointly ranked to calculate victory margins ($\Delta = \text{bestScore} - \text{secondScore}$), detecting blanks, single winners, multiple marks, and ambiguous answers.
4. **True Geometric Validation**: All four corner fiducials are detected and evaluated for Euclidean homography reprojection error ($\le 3.0\text{ px}$) before locking alignment.
5. **Synchronize all four engine implementations** whenever making algorithmic changes:
   - `src/utils/omrConfig.ts` (Standardized V5 configuration)
   - `src/utils/omrMeasurementCore.ts` (Core TypeScript CV & Precomputed Masks)
   - `src/utils/serverOmrCv.ts` (Node.js / Sharp server pipeline)
   - `src/utils/omrCvEngine.ts` (Client-side HTML5 Canvas pipeline)
   - `omr_scanner.cpp` (C++17 OpenCV reference engine)
   - `omr_scanner.py` (Python 3 reference script)

---

## 2. Document Space & Geometric Template

All measurements take place in the canonical dimension of **$1467 \times 2048$ pixels**.

### Fiducials (Corner Markers)
Perspective homography aligns the four outer corner black square fiducials ($43 \times 43\text{ px}$):
- `TL`: $(110.0, 252.0)$
- `TR`: $(1355.0, 252.0)$
- `BR`: $(1355.0, 1928.0)$
- `BL`: $(110.0, 1928.0)$

### 12-Digit Learner Reference Number (LRN) Grid
- **Columns (12 digits)**: `X = [322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760]`
- **Rows (0 through 9)**: `Y = [428, 473, 518, 563, 608, 653, 697, 742, 788, 834]`
- **Physical Bubble Radius**: `13.5 px`
- **Core Radius**: `6.0 px`, **Ring Inner/Outer**: `10.0 / 13.0 px`

### 60 Questions Grid (3 Columns $\times$ Top & Bottom Sections)
- **Top Section (Rows 0–9)**: `Q01–Q10` (Col 1), `Q11–Q20` (Col 2), `Q21–Q30` (Col 3)
- **Bottom Section (Rows 10–19)**: `Q31–Q40` (Col 1), `Q41–Q50` (Col 2), `Q51–Q60` (Col 3)
- **Column 1**: `A: 392, B: 436, C: 480, D: 524`
- **Column 2**: `A: 673, B: 717, C: 761, D: 807`
- **Column 3**: `A: 951, B: 997, C: 1041, D: 1087`
- **Rows (1 – 20)**: `Y = [947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386, 1478, 1528, 1577, 1625, 1673, 1722, 1771, 1820, 1868, 1918]`
- **Physical Bubble Radius**: `15.0 px`
- **Core Radius**: `7.5 px`, **Ring Inner/Outer**: `12.0 / 15.0 px`, **Paper Annulus Inner/Outer**: `18.0 / 22.0 px`

---

## 3. Production Configuration (V5.0)

```typescript
export interface OMRConfig {
  configVersion: "5.0.0";
  canonicalWidth: 1467;
  canonicalHeight: 2048;
  physicalBubbleRadius: 15.0;
  physicalLrnBubbleRadius: 13.5;

  questionCoreRadius: 7.5;
  questionRingInnerRadius: 12.0;
  questionRingOuterRadius: 15.0;
  questionPaperRingInnerRadius: 18.0;
  questionPaperRingOuterRadius: 22.0;

  lrnCoreRadius: 6.0;
  lrnRingInnerRadius: 10.0;
  lrnRingOuterRadius: 13.0;

  centerSearchRadiusPx: 12;
  maxCenterOffsetPx: 14.0;

  adaptiveOffsetMin: 18.0;
  adaptiveOffsetRatio: 0.12;

  contrastWeight: 0.35;
  darkRatioWeight: 0.30;
  percentileWeight: 0.20;
  componentWeight: 0.10;
  centroidWeight: 0.05;

  minFillScore: 0.20;
  minClassificationMargin: 0.10;
  multipleScore: 0.20;

  minFiducialConfidence: 0.70;
  maxReprojectionErrorPx: 3.0;
  minSheetCoverage: 90.0;
}
```

---

## 4. Algorithmic Equations

### 1. Precomputed Two-Zone Extraction
- Inner Core: $r \le r_{\text{core}}$
- Reference Paper Annulus: $r_{\text{in}} \le r \le r_{\text{out}}$

### 2. Relative Local Contrast
$$\text{Contrast} = \max\left(0.0, \min\left(1.0, \frac{\mu_{\text{paper}} - \mu_{\text{core}}}{\max(1.0, \mu_{\text{paper}})}\right)\right)$$

### 3. Percentile Darkness ($P_{20}$)
Let $P$ be sorted ascending pixel values in the inner core. $p_{20} = P[\lfloor 0.20 \times (|P|-1) \rfloor]$.
$$\text{PercentileDarkness} = \max\left(0.0, \min\left(1.0, \frac{\mu_{\text{paper}} - p_{20}}{\max(1.0, \mu_{\text{paper}})}\right)\right)$$

### 4. Adaptive Dark Pixel Ratio
$$\text{Threshold}_{\text{adaptive}} = \mu_{\text{paper}} - \max(18.0, \mu_{\text{paper}} \times 0.12)$$
$$\text{DarkRatio} = \frac{1}{|P|} \sum_{v \in P} \begin{cases} 1 & \text{if } v < \text{Threshold}_{\text{adaptive}} \\ 0 & \text{otherwise} \end{cases}$$

### 5. Multi-Feature Composite Score
$$\text{Score} = 0.35 \times \text{Contrast} + 0.30 \times \text{DarkRatio} + 0.20 \times \text{PercentileDarkness} + 0.10 \times \text{ComponentScore} + 0.05 \times \text{CentroidScore}$$

---

## 5. Verification & Testing

To test the entire CV engine pipeline and verify sample sheet recognition:
```bash
npx tsx scripts/test_omr_engine.ts
```
