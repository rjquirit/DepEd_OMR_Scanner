# DepEd Region X 60-Item OMR Scanner (Tangerine Orange Edition)

A high-performance, edge-capable Optical Mark Recognition (OMR) document processing system engineered for the standardized Department of Education (DepEd) Region X 60-item examination bubble sheets. 

The application integrates deterministic Computer Vision algorithms (TypeScript/Node.js, C++ OpenCV, and client-side Canvas Web APIs) with offline-first Progressive Web App (PWA) capabilities and full-stack grading workflows.

---

## 🌟 Key Features

- **Standardized OMR Recognition**:
  - Extracts 12-digit Learner Reference Numbers (LRN) across 10-digit vertical grids.
  - Grades 60 multiple-choice questions ($A, B, C, D$) across 3 column blocks.
- **Two-Zone Circular Measurement Model**:
  - Compares the inner graphite core ($r_{\text{inner}} = 0.55 \times r$) against the outer paper ring ($r_{\text{ring}} = 0.72 \to 1.0 \times r$).
  - Completely immune to global illumination gradients, shadows, and varying pencil hardness.
- **Question-Level Ranking Classifier**:
  - Evaluates all options collectively to identify single winners, detect multiple answers, and isolate blank items with confidence scoring.
- **Offline-First PWA**:
  - Installable on desktop and mobile (iOS Safari, Android Chrome, Edge).
  - In-browser client-side Computer Vision engine operates completely offline without server roundtrips.
- **Live Camera Viewfinder & File Upload**:
  - Real-time video stream capture with fiducial alignment guides.
  - Drag-and-drop batch file processing.
- **Visual Diagnostics & Inspection**:
  - Interactive side-by-side verification with color-coded diagnostic overlays (Green = Accepted, Red = Multiple, Yellow = Ambiguous, Gray = Blank).
- **Exam Suite Tools**:
  - Custom Answer Key Builder with weighting and item-level editing.
  - Class Gradebook & Roster Management with CSV and JSON export.
  - Printable Standard OMR Answer Sheet Generator with customizable headers.

---

## 📐 Sheet Geometry & Canonical Coordinates

The canonical document space is normalized to **$1467 \times 2048$ pixels** using 4 corner fiducial markers:

### 1. Four Corner Fiducials
- **Top-Left (TL)**: `(110.0, 252.0)`
- **Top-Right (TR)**: `(1355.0, 252.0)`
- **Bottom-Right (BR)**: `(1355.0, 1928.0)`
- **Bottom-Left (BL)**: `(110.0, 1928.0)`

### 2. 12-Digit Student LRN Grid
- **Column X Centers**: `[322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760]`
- **Row Y Centers (Digits 0–9)**: `[428, 473, 518, 563, 608, 653, 697, 738, 783, 828]`
- **Bubble Radius**: `9.5 px`

### 3. 60-Item Answer Columns
- **Column 1 (Q1 – Q20)**: `A: 392, B: 436, C: 480, D: 524`
- **Column 2 (Q21 – Q40)**: `A: 673, B: 717, C: 761, D: 807`
- **Column 3 (Q41 – Q60)**: `A: 951, B: 997, C: 1041, D: 1087`
- **Row Y Centers (Rows 1–20)**: `[947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386, 1464, 1514, 1563, 1611, 1659, 1708, 1757, 1806, 1854, 1903]`
- **Bubble Radius**: `11.0 px`

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend & Server Engine**: Express, Node.js, `sharp` (libvips C++ image processing binding)
- **Client CV Engine**: Pure HTML5 Canvas 2D image data processor
- **Stand-alone Native CV Engines**: C++17 OpenCV 4.x (`omr_scanner.cpp`) and Python 3 OpenCV (`omr_scanner.py`)
- **PWA**: Custom Service Worker (`sw.js`), Web App Manifest (`manifest.json`), `beforeinstallprompt` lifecycle management

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (or 20+)
- npm, yarn, or pnpm

### Installation & Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The app will run at `http://localhost:3000`.

3. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

---

## 🔬 Running the C++ / Python Standalone Engines

### C++ OpenCV Native CLI Scanner
```bash
# Compile with C++17 and OpenCV 4
g++ -O3 -std=c++17 omr_scanner.cpp -o omr_scanner `pkg-config --cflags --libs opencv4`

# Run scan on an answer sheet
./omr_scanner "sample answered 60 item bubble sheet.png" "debug_output.png"
```

### Python Scanner
```bash
python3 omr_scanner.py "sample answered 60 item bubble sheet.png"
```

---

## 📊 OMR Diagnostic Status Codes

| Marker Visual | Classification | Meaning | Action Required |
| :--- | :--- | :--- | :--- |
| 🟢 **Green Circle** | `ACCEPTED` | High-confidence, single winner mark | Automatically graded |
| 🔴 **Red Solid Circle** | `MULTIPLE` | Multiple choices shaded with narrow margin | Graded as incorrect / flagged |
| 🟡 **Orange Circle** | `AMBIGUOUS` | Weak victory margin or faint mark | Flagged for teacher review |
| ⚪ **Dashed Gray** | `BLANK` | Bubble unshaded | Graded as unanswered |

---

## 📄 License & Attribution
Designed for Department of Education (DepEd) Region X educational institutions. Distributed under the MIT License.
