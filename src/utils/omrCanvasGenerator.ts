import { OMRMetadata, OptionType } from "../types";
import {
  QUESTION_BLOCKS,
  QUESTION_ROWS_Y,
  LRN_COLS_X,
  LRN_ROWS_Y,
  REF_HEIGHT,
  REF_WIDTH,
} from "./omrConfig";

export interface SheetGenerationOptions {
  lrn: string; // 12 characters (digits 0-9 or ?)
  metadata: OMRMetadata;
  answers: Record<number, OptionType>; // 1-60
  includeFiducials?: boolean;
  addScanNoise?: boolean; // simulates camera/paper lighting
  title?: string;
  examTitle?: string;
}

export { REF_WIDTH, REF_HEIGHT };

/**
 * Generates an ultra-crisp standardized 60-item OMR Answer Sheet onto an HTML Canvas
 * with exact 1467 x 2048 resolution matching the official "blank bubble sheet 60 items.png" template.
 */
export function generateOMRSheetCanvas(
  options: Partial<SheetGenerationOptions> = {},
  width = REF_WIDTH,
  height = REF_HEIGHT
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const {
    lrn = "112298760012",
    metadata = {
      name: "JUAN DELA CRUZ",
      section: "10 - RIZAL",
      school_id: "301942",
      grade_level: "GRADE 10",
      subject: "SCIENCE & TECH",
    },
    answers = {},
    includeFiducials = true,
    addScanNoise = false,
  } = options;

  // Background - clean paper white
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // 1. Black Corner Fiducial Markers (Exact centers: TL 110,252; TR 1355,252; BL 110,1928; BR 1355,1928)
  if (includeFiducials) {
    ctx.fillStyle = "#000000";
    const fiducialHalf = 24;
    // TL
    ctx.fillRect(110 - fiducialHalf, 252 - fiducialHalf, fiducialHalf * 2, fiducialHalf * 2);
    // TR
    ctx.fillRect(1355 - fiducialHalf, 252 - fiducialHalf, fiducialHalf * 2, fiducialHalf * 2);
    // BL
    ctx.fillRect(110 - fiducialHalf, 1928 - fiducialHalf, fiducialHalf * 2, fiducialHalf * 2);
    // BR
    ctx.fillRect(1355 - fiducialHalf, 1928 - fiducialHalf, fiducialHalf * 2, fiducialHalf * 2);

    // Left and right timing marks
    for (let y = 300; y <= 1880; y += 30) {
      ctx.fillRect(80, y - 3, 16, 6);
      ctx.fillRect(1370, y - 3, 16, 6);
    }
  }

  // 2. Header Box & Titles
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 3;
  ctx.strokeRect(170, 70, 1127, 130);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DEPARTMENT OF EDUCATION", width / 2, 112);

  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("STANDARDIZED ASSESSMENT ANSWER SHEET (60 ITEMS)", width / 2, 150);

  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("LRN / 60-ITEM EXAM FORM • SHADE PENCIL #2 OR BLACK INK ONLY", width / 2, 180);

  // 3. Student Information Section (Left)
  const infoLeft = 170;
  const infoTop = 230;
  const infoWidth = 620;
  const infoHeight = 630;

  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 2;
  ctx.strokeRect(infoLeft, infoTop, infoWidth, infoHeight);

  ctx.fillStyle = "#1E293B";
  ctx.fillRect(infoLeft, infoTop, infoWidth, 36);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("STUDENT INFORMATION", infoLeft + 16, infoTop + 24);

  const drawField = (label: string, val: string | null, y: number) => {
    ctx.fillStyle = "#334155";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, infoLeft + 20, y);

    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(infoLeft + 140, y + 4);
    ctx.lineTo(infoLeft + infoWidth - 20, y + 4);
    ctx.stroke();

    if (val) {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 17px monospace";
      ctx.fillText(val.toUpperCase(), infoLeft + 145, y);
    }
  };

  drawField("NAME:", metadata.name, infoTop + 90);
  drawField("SECTION:", metadata.section, infoTop + 160);
  drawField("SCHOOL ID:", metadata.school_id, infoTop + 230);
  drawField("GRADE LEVEL:", metadata.grade_level, infoTop + 300);
  drawField("SUBJECT:", metadata.subject, infoTop + 370);

  // Instructions inside info box
  ctx.fillStyle = "#F1F5F9";
  ctx.fillRect(infoLeft + 16, infoTop + 430, infoWidth - 32, 170);
  ctx.strokeStyle = "#CBD5E1";
  ctx.strokeRect(infoLeft + 16, infoTop + 430, infoWidth - 32, 170);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("EXAM GUIDELINES:", infoLeft + 30, infoTop + 460);
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("1. Use soft black pencil or dark black ink pen.", infoLeft + 30, infoTop + 490);
  ctx.fillText("2. Completely shade the bubble for your chosen answer.", infoLeft + 30, infoTop + 518);
  ctx.fillText("3. Keep sheet flat and clean. Do not fold or smudge marks.", infoLeft + 30, infoTop + 546);
  ctx.fillText("CORRECT: ⬤   INCORRECT: ✖  ✔  ◐  ━", infoLeft + 30, infoTop + 576);

  // 4. LRN Grid (Right)
  const lrnBoxLeft = 810;
  const lrnBoxWidth = 487;
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 2;
  ctx.strokeRect(lrnBoxLeft, infoTop, lrnBoxWidth, infoHeight);

  ctx.fillStyle = "#1E293B";
  ctx.fillRect(lrnBoxLeft, infoTop, lrnBoxWidth, 36);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STUDENT LRN (12 DIGITS)", lrnBoxLeft + lrnBoxWidth / 2, infoTop + 24);

  // Draw 12 digit boxes and bubbles
  const cleanLrn = (lrn || "").padEnd(12, "?");
  for (let c = 0; c < 12; c++) {
    const cx = LRN_COLS_X[c] || (lrnBoxLeft + 30 + c * 36);
    
    // Top digit box
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 14, infoTop + 48, 28, 28);
    const char = cleanLrn[c];
    if (char && char !== "?") {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(char, cx, infoTop + 68);
    }

    // 0-9 bubbles
    const targetDigit = char !== "?" ? parseInt(char, 10) : -1;
    for (let r = 0; r <= 9; r++) {
      const cy = LRN_ROWS_Y[r];
      const isFilled = targetDigit === r;

      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      if (isFilled) {
        ctx.fillStyle = "#111827";
        ctx.fill();
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#475569";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(r.toString(), cx, cy);
      }
    }
  }

  // 5. 60 Questions Answer Section (3 Columns x Top & Bottom Sections)
  const ansBoxTop = 880;
  const ansBoxHeight = 1070;
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 2;
  ctx.strokeRect(170, ansBoxTop, 1127, ansBoxHeight);

  // Main Header
  ctx.fillStyle = "#1E293B";
  ctx.fillRect(170, ansBoxTop, 1127, 34);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("EXAMINATION ITEMS (1 - 60)", width / 2, ansBoxTop + 23);

  const opts: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const itemLabelX = { 1: 350, 2: 630, 3: 910 };

  // Render each of the 6 Question Section Blocks
  QUESTION_BLOCKS.forEach((block) => {
    const itemX = itemLabelX[block.column];

    // Column header for A B C D at the top of each block
    const headerY = block.section === "TOP" ? ansBoxTop + 54 : 1435;
    ctx.fillStyle = "#475569";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ITEM", itemX, headerY);
    opts.forEach((opt) => {
      ctx.fillText(opt, block[opt], headerY);
    });

    // 10 Rows per block
    for (let r = 0; r < 10; r++) {
      const qNum = block.startQ + r;
      const globalRowIdx = block.startRowIdx + r;
      const cy = QUESTION_ROWS_Y[globalRowIdx];
      const selected = answers[qNum];

      // Item number
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 15px monospace";
      ctx.textAlign = "right";
      ctx.fillText(qNum.toString().padStart(2, "0") + ".", itemX + 16, cy);

      // Bubbles A, B, C, D
      opts.forEach((opt) => {
        const bx = block[opt];
        const isFilled = selected === opt || (selected === "MULTIPLE" && (opt === "A" || opt === "C"));

        ctx.beginPath();
        ctx.arc(bx, cy, 11, 0, Math.PI * 2);
        if (isFilled) {
          ctx.fillStyle = "#111827";
          ctx.fill();
          ctx.strokeStyle = "#111827";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = "#475569";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(opt, bx, cy);
        }
      });
    }
  });

  // Footer bar
  ctx.fillStyle = "#64748B";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DEPED OFFICIAL OMR FORM-60 • CALIBRATED FIDUCIAL TIMING GRID", width / 2, height - 35);

  // Optional noise
  if (addScanNoise) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let p = 0; p < d.length; p += 4) {
      const noise = (Math.random() - 0.5) * 10;
      d[p] = Math.min(255, Math.max(0, d[p] + noise));
      d[p + 1] = Math.min(255, Math.max(0, d[p + 1] + noise));
      d[p + 2] = Math.min(255, Math.max(0, d[p + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
}

/**
 * Creates preset sample sheets for immediate 1-click testing.
 */
export function getSampleSheets(): { id: string; name: string; description: string; options: Partial<SheetGenerationOptions> }[] {
  const perfectAnswers: Record<number, OptionType> = {};
  const pattern1: OptionType[] = ["A", "B", "C", "D", "A", "C", "B", "D", "B", "A", "C", "D", "A", "B", "C"];
  for (let i = 1; i <= 60; i++) {
    perfectAnswers[i] = pattern1[(i - 1) % pattern1.length];
  }

  const typicalAnswers: Record<number, OptionType> = {};
  const pattern2: OptionType[] = ["A", "A", "A", "B", "C", "D", "C", "B", "A", "B", "C", "D", "B", "D", "A"];
  for (let i = 1; i <= 60; i++) {
    typicalAnswers[i] = pattern2[(i * 3) % pattern2.length];
  }

  const mixedAnswers: Record<number, OptionType> = {};
  for (let i = 1; i <= 60; i++) {
    if (i === 14 || i === 38) {
      mixedAnswers[i] = "MULTIPLE";
    } else if (i === 22 || i === 49 || i === 57) {
      mixedAnswers[i] = null;
    } else {
      mixedAnswers[i] = (["A", "B", "C", "D"] as const)[(i * 7) % 4];
    }
  }

  return [
    {
      id: "sample-deped-standard",
      name: "Standard Student (LRN: 112298760012)",
      description: "60-item filled answer sheet with Juan Dela Cruz, Grade 10 Rizal, Science.",
      options: {
        lrn: "112298760012",
        metadata: {
          name: "JUAN DELA CRUZ",
          section: "10 - RIZAL",
          school_id: "301942",
          grade_level: "GRADE 10",
          subject: "SCIENCE",
        },
        answers: typicalAnswers,
        addScanNoise: true,
      },
    },
    {
      id: "sample-high-score",
      name: "Honor Student (LRN: 204918273645)",
      description: "Complete answer sheet with Maria Santos, Grade 12 STEM, Mathematics.",
      options: {
        lrn: "204918273645",
        metadata: {
          name: "MARIA CLARA SANTOS",
          section: "12 - STEM NEWTON",
          school_id: "408129",
          grade_level: "GRADE 12",
          subject: "ADVANCED MATHEMATICS",
        },
        answers: perfectAnswers,
        addScanNoise: true,
      },
    },
    {
      id: "sample-edge-cases",
      name: "Edge Cases (Blanks & Multi-Marks)",
      description: "Demonstrates recognition of omitted bubbles and multiple shaded bubbles.",
      options: {
        lrn: "109845612300",
        metadata: {
          name: "ALEXIS G. BAUTISTA",
          section: "9 - EINSTEIN",
          school_id: "102834",
          grade_level: "GRADE 9",
          subject: "ENGLISH & LITERATURE",
        },
        answers: mixedAnswers,
        addScanNoise: true,
      },
    },
  ];
}
