import { OMRMetadata, OptionType } from "../types";

export interface SheetGenerationOptions {
  lrn: string; // 12 characters (digits 0-9 or ?)
  metadata: OMRMetadata;
  answers: Record<number, OptionType>; // 1-60
  includeFiducials?: boolean;
  addScanNoise?: boolean; // simulates camera/paper lighting
  title?: string;
  examTitle?: string;
}

/**
 * Generates an ultra-crisp standardized 60-item OMR Answer Sheet onto an HTML Canvas
 * and returns it as a data URL.
 */
export function generateOMRSheetCanvas(
  options: Partial<SheetGenerationOptions> = {},
  width = 1600,
  height = 2200
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
    title = "STANDARDIZED ASSESSMENT ANSWER SHEET",
    examTitle = "GENERAL SCHOLASTIC ACHIEVEMENT TEST (60 ITEMS)",
  } = options;

  // Background - clean white with slight paper warmth
  ctx.fillStyle = "#FAF9F6";
  ctx.fillRect(0, 0, width, height);

  // Helper drawing functions
  ctx.strokeStyle = "#1A1A1A";
  ctx.fillStyle = "#1A1A1A";

  // 1. Black Corner Fiducial Markers (Timing marks for OMR alignment)
  if (includeFiducials) {
    ctx.fillStyle = "#000000";
    const fiducialSize = 36;
    const margin = 30;
    // Top-left, Top-right, Bottom-left, Bottom-right
    ctx.fillRect(margin, margin, fiducialSize, fiducialSize);
    ctx.fillRect(width - margin - fiducialSize, margin, fiducialSize, fiducialSize);
    ctx.fillRect(margin, height - margin - fiducialSize, fiducialSize, fiducialSize);
    ctx.fillRect(width - margin - fiducialSize, height - margin - fiducialSize, fiducialSize, fiducialSize);

    // Left and Right timing tracks (vertical black ticks)
    for (let y = 140; y < height - 120; y += 40) {
      ctx.fillRect(margin + 6, y, 16, 6);
      ctx.fillRect(width - margin - 22, y, 16, 6);
    }
  }

  const contentLeft = 90;
  const contentRight = width - 90;
  const contentWidth = contentRight - contentLeft;

  // 2. Header Box & Title
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#0F172A";
  ctx.strokeRect(contentLeft, 70, contentWidth, 90);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 108);

  ctx.font = "bold 18px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText(examTitle, width / 2, 138);

  // 3. Instructions & Guide Strip
  ctx.fillStyle = "#F1F5F9";
  ctx.fillRect(contentLeft, 175, contentWidth, 54);
  ctx.strokeRect(contentLeft, 175, contentWidth, 54);

  ctx.fillStyle = "#0F172A";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("INSTRUCTIONS: Use #2 Pencil or Black Pen only. Completely fill the circle corresponding to your chosen answer.", contentLeft + 16, 198);
  ctx.fillText("CORRECT MARK: ⬤   INCORRECT MARKS: ✖  ✔  ◐  ━", contentLeft + 16, 218);

  // 4. Student Information Grid (Left) & LRN Grid (Right)
  const infoTop = 245;
  const infoHeight = 310;
  const splitX = contentLeft + 520; // dividing student info from LRN grid

  // Student Info Box
  ctx.strokeRect(contentLeft, infoTop, 500, infoHeight);
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("STUDENT INFORMATION", contentLeft + 16, infoTop + 26);

  const renderField = (label: string, value: string | null, y: number) => {
    ctx.fillStyle = "#475569";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(label, contentLeft + 16, y);
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(contentLeft + 140, y + 4);
    ctx.lineTo(contentLeft + 480, y + 4);
    ctx.stroke();

    if (value) {
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 17px monospace";
      ctx.fillText(value.toUpperCase(), contentLeft + 145, y);
    }
  };

  renderField("NAME:", metadata.name, infoTop + 70);
  renderField("SECTION:", metadata.section, infoTop + 115);
  renderField("SCHOOL ID:", metadata.school_id, infoTop + 160);
  renderField("GRADE LEVEL:", metadata.grade_level, infoTop + 205);
  renderField("SUBJECT:", metadata.subject, infoTop + 250);

  // 5. Student LRN Grid (12 Columns, 0-9 rows)
  const lrnBoxLeft = splitX;
  const lrnBoxWidth = contentRight - splitX;
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 3;
  ctx.strokeRect(lrnBoxLeft, infoTop, lrnBoxWidth, infoHeight);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STUDENT LRN (LEARNER REFERENCE NUMBER)", lrnBoxLeft + lrnBoxWidth / 2, infoTop + 26);

  // 12 Column headers + 0-9 bubble grid
  const lrnCols = 12;
  const lrnRows = 10; // 0 to 9
  const gridStartX = lrnBoxLeft + 35;
  const colSpacing = (lrnBoxWidth - 70) / (lrnCols - 1);
  const rowStartY = infoTop + 85;
  const rowSpacing = 21;

  // LRN digits written boxes
  ctx.font = "bold 15px monospace";
  for (let c = 0; c < lrnCols; c++) {
    const cx = gridStartX + c * colSpacing;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 13, infoTop + 40, 26, 26);
    
    // digit in box
    const digitChar = lrn[c] || "";
    if (digitChar && digitChar !== "?") {
      ctx.fillStyle = "#0F172A";
      ctx.textAlign = "center";
      ctx.fillText(digitChar, cx, infoTop + 58);
    }
  }

  // Draw 12x10 LRN bubbles
  for (let c = 0; c < lrnCols; c++) {
    const cx = gridStartX + c * colSpacing;
    const targetDigit = lrn[c] !== "?" ? parseInt(lrn[c], 10) : -1;

    for (let r = 0; r <= 9; r++) {
      const cy = rowStartY + r * rowSpacing;
      const isFilled = targetDigit === r;

      ctx.beginPath();
      ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
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

        ctx.fillStyle = "#64748B";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(r.toString(), cx, cy);
      }
    }
  }

  // 6. 60-Item Answers Grid (4 Columns of 15 Items each)
  const answersTop = 575;
  const answersHeight = height - answersTop - 80;
  const numColumns = 4;
  const columnWidth = (contentWidth - 60) / numColumns;

  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 3;
  ctx.strokeRect(contentLeft, answersTop, contentWidth, answersHeight);

  // Title bar for Answers section
  ctx.fillStyle = "#1E293B";
  ctx.fillRect(contentLeft, answersTop, contentWidth, 36);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXAMINATION ANSWER SHEET — 60 ITEMS", width / 2, answersTop + 18);

  const optionsList = ["A", "B", "C", "D"] as const;
  const optSpacing = 28;

  for (let colIdx = 0; colIdx < numColumns; colIdx++) {
    const colLeft = contentLeft + 15 + colIdx * (columnWidth + 10);
    const startItem = colIdx * 15 + 1;
    const endItem = startItem + 14;

    // Column container outline
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(colLeft, answersTop + 50, columnWidth, answersHeight - 65);

    // Column Header (Item | A B C D)
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(colLeft, answersTop + 50, columnWidth, 34);
    ctx.fillStyle = "#334155";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ITEM", colLeft + 40, answersTop + 68);

    const bubbleGroupCenterX = colLeft + columnWidth - 75;
    optionsList.forEach((opt, oIdx) => {
      const bx = bubbleGroupCenterX - (1.5 * optSpacing) + oIdx * optSpacing;
      ctx.fillText(opt, bx, answersTop + 68);
    });

    // Draw 15 Items in this column
    const itemRowSpacing = (answersHeight - 110) / 15;
    for (let i = 0; i < 15; i++) {
      const itemNum = startItem + i;
      const rowY = answersTop + 102 + i * itemRowSpacing;

      // Alternating row background for clean scanning readability
      if (i % 2 === 1) {
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(colLeft + 2, rowY - 14, columnWidth - 4, itemRowSpacing);
      }

      // Item Number
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 15px monospace";
      ctx.textAlign = "right";
      ctx.fillText(itemNum.toString().padStart(2, "0") + ".", colLeft + 52, rowY);

      // Bubbles A, B, C, D
      const selected = answers[itemNum];

      optionsList.forEach((opt, oIdx) => {
        const bx = bubbleGroupCenterX - (1.5 * optSpacing) + oIdx * optSpacing;
        let isFilled = false;

        if (selected === opt) {
          isFilled = true;
        } else if (selected === "MULTIPLE") {
          // If multiple, shade A and C for demonstration
          if (opt === "A" || opt === "C" || (itemNum % 2 === 0 && opt === "B")) {
            isFilled = true;
          }
        }

        ctx.beginPath();
        ctx.arc(bx, rowY, 9.5, 0, Math.PI * 2);

        if (isFilled) {
          ctx.fillStyle = "#0F172A";
          ctx.fill();
          ctx.strokeStyle = "#0F172A";
          ctx.lineWidth = 2;
          ctx.stroke();

          // slight pencil graphite texture highlight
          ctx.beginPath();
          ctx.arc(bx - 2, rowY - 2, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#1E293B";
          ctx.fill();
        } else {
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = "#64748B";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(opt, bx, rowY);
        }
      });
    }
  }

  // Footer bar
  ctx.fillStyle = "#64748B";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DO NOT FOLD OR TEAR THIS SHEET • STANDARDIZED OMR SCANNER SHEET v2.4 • FORM-60", width / 2, height - 35);

  // Optional scanning artifact noise
  if (addScanNoise) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let p = 0; p < data.length; p += 4) {
      const noise = (Math.random() - 0.5) * 12;
      data[p] = Math.min(255, Math.max(0, data[p] + noise));
      data[p + 1] = Math.min(255, Math.max(0, data[p + 1] + noise));
      data[p + 2] = Math.min(255, Math.max(0, data[p + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
}

/**
 * Creates preset sample sheets for immediate 1-click testing.
 */
export function getSampleSheets(): { id: string; name: string; description: string; options: SheetGenerationOptions }[] {
  // Sample 1: Perfect / High Scorer
  const perfectAnswers: Record<number, OptionType> = {};
  const pattern1: OptionType[] = ["A", "B", "C", "D", "A", "C", "B", "D", "B", "A", "C", "D", "A", "B", "C"];
  for (let i = 1; i <= 60; i++) {
    perfectAnswers[i] = pattern1[(i - 1) % pattern1.length];
  }

  // Sample 2: Typical Student with realistic answers
  const typicalAnswers: Record<number, OptionType> = {};
  const pattern2: OptionType[] = ["A", "A", "A", "B", "C", "D", "D", "C", "B", "A", "B", "C", "D", "A", "C"];
  for (let i = 1; i <= 60; i++) {
    typicalAnswers[i] = pattern2[(i * 3) % pattern2.length];
  }

  // Sample 3: Sheet with multiple marks and blank items
  const mixedAnswers: Record<number, OptionType> = {};
  for (let i = 1; i <= 60; i++) {
    if (i === 14 || i === 38) {
      mixedAnswers[i] = "MULTIPLE";
    } else if (i === 22 || i === 49 || i === 57) {
      mixedAnswers[i] = null; // left blank
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
