# AGENTS.md — Coding Agent & System Architecture Guide

> **Target Audience:** AI Coding Agents, Automated Maintainers, Computer Vision Engineers.
> **Scope:** DepEd Region X 60-Item OMR Scanner (Web Client, Server, C++ OpenCV, and Python CV Engines).

---

## 1. System Overview & Core Principles

The DepEd Region X OMR Scanner processes multiple-choice bubble answer sheets scanned or photographed under varying angles, distances, shadows, and pencil intensities.

### Core Non-Negotiables for Agents:
1. **Never use darkest-pixel local searching** (`dx, dy ∈ [-6, 6] search window`) to detect bubble locations. Bubble coordinates are deterministic and come **strictly from the calibrated canonical template** after 4-point homographic perspective correction.
2. **Never classify bubbles using absolute grayscale thresholds** (e.g. `val < 130` or `intensity < 0.38`). The system uses a **Two-Zone Circular Measurement Model** that measures the relative contrast of the inner graphite core against the immediate local paper background ring.
3. **Always classify at the Question Level**, not individual bubbles. Options $A, B, C, D$ for each question must be jointly ranked to calculate victory margins ($\Delta = \text{bestScore} - \text{secondScore}$), detecting blanks, single winners, multiple marks, and ambiguous answers.
4. **Synchronize all four engine implementations** whenever making algorithmic changes:
   - `src/utils/omrMeasurementCore.ts` (Core TypeScript CV)
   - `src/utils/serverOmrCv.ts` (Node.js / Sharp server pipeline)
   - `src/utils/omrCvEngine.ts` (Client-side HTML5 Canvas pipeline)
   - `omr_scanner.cpp` (C++17 OpenCV reference engine)
   - `omr_scanner.py` (Python 3 reference script)

---

## 2. Document Space & Geometric Template

All measurements take place in the canonical dimension of **$1467 \times 2048$ pixels**.

### Fiducials (Corner Markers)
Perspective homography aligns the four outer corner black square fiducials:
- `TL`: $(110.0, 252.0)$
- `TR`: $(1355.0, 252.0)$
- `BR`: $(1355.0, 1928.0)$
- `BL`: $(110.0, 1928.0)$

### 12-Digit Learner Reference Number (LRN) Grid
- **Columns (12 digits)**: `X = [322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760]`
- **Rows (0 through 9)**: `Y = [428, 473, 518, 563, 608, 653, 697, 738, 783, 828]`
- **Bubble Radius**: `9.5 px`

### 60 Questions Grid (3 Columns $\times$ 20 Rows)
- **Column 1 (Q1 – Q20)**: `A: 392, B: 436, C: 480, D: 524`
- **Column 2 (Q21 – Q40)**: `A: 673, B: 717, C: 761, D: 807`
- **Column 3 (Q41 – Q60)**: `A: 951, B: 997, C: 1041, D: 1087`
- **Rows (1 – 20)**: `Y = [947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386, 1464, 1514, 1563, 1611, 1659, 1708, 1757, 1806, 1854, 1903]`
- **Bubble Radius**: `11.0 px`

---

## 3. C++ OpenCV Configuration & Struct Definitions

Below is the production C++ configuration and data model matching `omr_scanner.cpp`:

```cpp
#include <opencv2/opencv.hpp>
#include <vector>
#include <algorithm>
#include <string>
#include <cmath>

struct OMRConfig {
    // Geometry ratios
    double bubbleRadius = 11.0;          // Outer radius of exam bubbles (px)
    double lrnBubbleRadius = 9.5;        // Outer radius of LRN bubbles (px)
    double innerRadiusRatio = 0.55;      // Inner core boundary (r_inner = 0.55 * r)
    double ringInnerRatio = 0.72;        // Paper ring inner boundary (r_ring = 0.72 * r)

    // Score weight distribution (Sums to 1.00)
    double contrastWeight = 0.45;        // Weight for relative local contrast
    double darkRatioWeight = 0.35;       // Weight for adaptive dark pixel proportion
    double percentileWeight = 0.20;      // Weight for 20th percentile darkness (P20)

    // Adaptive threshold offsets
    double adaptiveOffsetMin = 18.0;     // Minimum local luminance drop from paper
    double adaptiveOffsetRatio = 0.12;   // Proportional luminance drop from paper

    // Question classification thresholds
    double minScore = 0.20;              // Minimum composite score for a valid mark
    double minMargin = 0.10;             // Margin between 1st & 2nd choice (best - second)
    double multipleScore = 0.20;         // Score threshold triggering multi-mark evaluation
};

struct BubbleMetric {
    int cx = 0;
    int cy = 0;
    double radius = 11.0;
    double innerMean = 255.0;
    double ringMean = 255.0;
    double p20 = 255.0;
    double darkRatio = 0.0;
    double contrast = 0.0;
    double percentileDarkness = 0.0;
    double score = 0.0;
    bool filled = false;
};

struct QuestionClassification {
    int questionNumber = 0;
    char answer = '-';                   // 'A', 'B', 'C', 'D', 'M' (Multiple), or '-' (Blank)
    char bestOption = 'A';
    double bestScore = 0.0;
    char secondOption = 'B';
    double secondScore = 0.0;
    double margin = 0.0;
    double confidence = 0.0;             // 0.0 to 1.0
    bool isBlank = true;
    bool isMultiple = false;
    bool isAmbiguous = false;
    std::vector<BubbleMetric> metrics;   // Metrics for A, B, C, D
};
```

---

## 4. Algorithmic Equations

### 1. Two-Zone Pixel Extraction
For each bubble center $(c_x, c_y)$ and outer radius $R$:
$$\text{Inner Core Region: } \sqrt{(x - c_x)^2 + (y - c_y)^2} \le 0.55 \times R$$
$$\text{Local Background Ring: } 0.72 \times R \le \sqrt{(x - c_x)^2 + (y - c_y)^2} \le 1.0 \times R$$

### 2. Relative Local Contrast
$$\text{Contrast} = \max\left(0.0, \frac{\mu_{\text{ring}} - \mu_{\text{inner}}}{\max(1.0, \mu_{\text{ring}})}\right)$$

### 3. Percentile Darkness ($P_{20}$)
Let $P$ be sorted ascending pixel values in the inner core. $p_{20} = P[\lfloor 0.20 \times (|P|-1) \rfloor]$.
$$\text{PercentileDarkness} = \max\left(0.0, \frac{\mu_{\text{ring}} - p_{20}}{\max(1.0, \mu_{\text{ring}})}\right)$$

### 4. Adaptive Dark Pixel Ratio
$$\text{Threshold}_{\text{adaptive}} = \mu_{\text{ring}} - \max(18.0, \mu_{\text{ring}} \times 0.12)$$
$$\text{DarkRatio} = \frac{1}{|P|} \sum_{v \in P} \begin{cases} 1 & \text{if } v < \text{Threshold}_{\text{adaptive}} \\ 0 & \text{otherwise} \end{cases}$$

### 5. Composite Score
$$\text{Score} = 0.45 \times \text{Contrast} + 0.35 \times \text{DarkRatio} + 0.20 \times \text{PercentileDarkness}$$

---

## 5. Directory Structure & Key Files

```
├── AGENTS.md                  # This file: Agent instructions and C++ config
├── README.md                  # Project overview, documentation, setup
├── metadata.json              # Applet metadata, capabilities, permissions
├── package.json               # Full-stack Node scripts and dependencies
├── server.ts                  # Express server & API endpoints (/api/scan, /api/health)
├── omr_scanner.cpp            # Production C++ OpenCV 4.x reference engine
├── omr_scanner.py             # Production Python OpenCV reference engine
├── public/
│   ├── manifest.json          # PWA Web App Manifest (Tangerine theme)
│   ├── sw.js                  # PWA Service Worker (Cache & Offline Support)
│   └── icons/                 # High-res PWA icon assets
├── src/
│   ├── App.tsx                # Main application component & tab controller
│   ├── main.tsx               # Entry point with HMR error suppression
│   ├── types.ts               # Global TypeScript definitions
│   ├── components/
│   │   ├── Navbar.tsx         # Top bar with PWA Install trigger
│   │   ├── MobileBottomNav.tsx# Touch-friendly bottom navigation bar
│   │   ├── AnswerKeys/        # Key configuration & answer editor
│   │   ├── Help/              # Printable guide & scoring manuals
│   │   ├── PWA/               # PWA Install Modal & platform instructions
│   │   ├── PrintableSheet/    # PDF & Canvas Answer Sheet Generator
│   │   ├── Results/           # Scan Result Inspector, Grade Cards, CSV Export
│   │   ├── Roster/            # Class Gradebook & Student Record Manager
│   │   └── Scanner/           # Live Viewfinder & Drag-and-Drop Uploader
│   └── utils/
│       ├── omrConfig.ts       # Canonical coordinates & threshold constants
│       ├── omrMeasurementCore.ts # Two-zone CV math & ranking classifier
│       ├── omrCvEngine.ts     # Client-side HTML5 Canvas CV scanner
│       ├── serverOmrCv.ts     # Server-side Sharp/Libvips CV scanner
│       ├── grading.ts         # Item evaluation and scoring engine
│       └── usePWA.ts          # Custom React hook for PWA install state
```

---

## 6. Guidelines for Making Future Modifications

1. **Adding Questions or Modifying Sheet Layout**:
   - Update coordinates in `src/utils/omrConfig.ts` first.
   - Propagate to `omr_scanner.cpp`, `omr_scanner.py`, and `src/utils/omrCanvasGenerator.ts`.
2. **PWA Enhancements**:
   - Keep `sw.js` cache versions incremented (`omr-scanner-v3`).
   - Retain the `usePWA` hook prompt interceptor for Safari/Chrome compatibility.
3. **Environment Constraints**:
   - Always run the server on port `3000` (`0.0.0.0`).
   - Keep `DISABLE_HMR=true` friendly error suppression in `index.html` and `main.tsx`.
