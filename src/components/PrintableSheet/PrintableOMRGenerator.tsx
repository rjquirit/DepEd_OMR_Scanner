import React, { useState, useEffect } from "react";
import { Printer, Download, Play, FileText, CheckCircle2, RefreshCw } from "lucide-react";
import { generateOMRSheetCanvas } from "../../utils/omrCanvasGenerator";
import { OptionType } from "../../types";

interface PrintableOMRGeneratorProps {
  onScanGeneratedSheet?: (dataUrl: string) => void;
}

export function PrintableOMRGenerator({ onScanGeneratedSheet }: PrintableOMRGeneratorProps) {
  const [lrnInput, setLrnInput] = useState("112298760012");
  const [studentName, setStudentName] = useState("JUAN DELA CRUZ");
  const [section, setSection] = useState("10 - RIZAL");
  const [schoolId, setSchoolId] = useState("301942");
  const [gradeLevel, setGradeLevel] = useState("GRADE 10");
  const [subject, setSubject] = useState("SCIENCE & TECH");
  const [sheetMode, setSheetMode] = useState<"blank" | "sample_filled">("blank");
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("/samples/blank_bubble_sheet_60.png");
  const [isGenerating, setIsGenerating] = useState(false);

  // Render or load sheet whenever mode or metadata changes
  useEffect(() => {
    let isCancelled = false;

    async function loadOrGenerateSheet() {
      setIsGenerating(true);
      if (sheetMode === "blank") {
        // Authentic official Blank Bubble Sheet 60 Items
        try {
          const response = await fetch("/samples/blank_bubble_sheet_60.png");
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = (e) => {
            if (!isCancelled) {
              setPreviewDataUrl(e.target?.result as string);
              setIsGenerating(false);
            }
          };
          reader.readAsDataURL(blob);
        } catch {
          if (!isCancelled) {
            setPreviewDataUrl("/samples/blank_bubble_sheet_60.png");
            setIsGenerating(false);
          }
        }
      } else {
        // Pre-filled with LRN & 60 answered items on calibrated 3-column template
        const filledAnswers: Record<number, OptionType> = {};
        const pattern: OptionType[] = ["A", "A", "A", "B", "C", "D", "C", "B", "A", "B", "C", "D", "B", "D", "A"];
        for (let i = 1; i <= 60; i++) {
          filledAnswers[i] = pattern[(i - 1) % pattern.length];
        }

        const canvas = generateOMRSheetCanvas({
          lrn: lrnInput || "112298760012",
          metadata: {
            name: studentName,
            section: section,
            school_id: schoolId,
            grade_level: gradeLevel,
            subject: subject,
          },
          answers: filledAnswers,
          includeFiducials: true,
          addScanNoise: false,
        });

        if (!isCancelled) {
          setPreviewDataUrl(canvas.toDataURL("image/png"));
          setIsGenerating(false);
        }
      }
    }

    loadOrGenerateSheet();

    return () => {
      isCancelled = true;
    };
  }, [sheetMode, lrnInput, studentName, section, schoolId, gradeLevel, subject]);

  // Trigger browser print
  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Standard 60-Item OMR Answer Sheet - ${sheetMode.toUpperCase()}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
            }
            img {
              width: 100vw;
              height: 100vh;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <img src="${previewDataUrl}" onload="window.print();window.close();" />
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Download High-Res PNG
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = previewDataUrl;
    a.download = sheetMode === "blank" 
      ? "blank bubble sheet 60 items.png" 
      : `sample_answered_60_items_${lrnInput}.png`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#272C33] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-[#FF7A00] rounded-xs shadow-[0_0_6px_#FF7A00]" />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              SHEET_GENERATOR // OFFICIAL_60_ITEMS_TEMPLATE
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
            <span>PRINTABLE_OMR_SHEET_GENERATOR</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Calibrated 60-item answer sheets (3×20 grid, 12-digit LRN, 4 corner fiducial marks).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            id="download-omr-sheet-btn"
            onClick={handleDownload}
            className="px-3.5 py-2 bg-[#14171A] hover:bg-slate-800 text-slate-300 text-xs font-bold uppercase rounded-xs border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT_PNG</span>
          </button>

          <button
            type="button"
            id="print-omr-sheet-btn"
            onClick={handlePrint}
            className="px-4 py-2 bg-[#FF7A00] text-black text-xs font-black uppercase tracking-wider rounded-xs shadow-[0_0_10px_#FF7A00] flex items-center space-x-1.5 transition-transform active:scale-95 hover:bg-[#FF8C1A]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PRINT_A4</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Options (Left) & Sheet Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Generator Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#14171A] p-4 rounded-xs border border-[#272C33] space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF7A00]" />
              <span>SHEET_CONFIGURATION</span>
            </h3>

            {/* Mode Picker (Blank vs Pre-filled) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="select-blank-sheet-mode-btn"
                onClick={() => setSheetMode("blank")}
                className={`py-2 px-2.5 rounded-xs text-xs font-bold uppercase border transition-all ${
                  sheetMode === "blank"
                    ? "bg-[#FF7A00] text-black border-[#FF7A00] shadow-[0_0_8px_rgba(255,122,0,0.3)] font-black"
                    : "bg-[#0D0F12] border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                BLANK_BUBBLE_SHEET
              </button>

              <button
                type="button"
                id="select-prefilled-sheet-mode-btn"
                onClick={() => setSheetMode("sample_filled")}
                className={`py-2 px-2.5 rounded-xs text-xs font-bold uppercase border transition-all ${
                  sheetMode === "sample_filled"
                    ? "bg-[#FF7A00] text-black border-[#FF7A00] shadow-[0_0_8px_rgba(255,122,0,0.3)] font-black"
                    : "bg-[#0D0F12] border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                PRE_FILLED_TEST
              </button>
            </div>

            {sheetMode === "blank" ? (
              <div className="p-3 bg-[#0D0F12] border border-slate-800 rounded-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>OFFICIAL_BLANK_TEMPLATE</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Source: <b className="text-white">blank bubble sheet 60 items.png</b> (1467 × 2048 px).
                  Includes 4 perimeter corner timing fiducials, 12-digit Learner Reference Number grid, and 60 answer choices (A, B, C, D) organized in 3 columns of 20 items.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-[#272C33]">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">
                    12_DIGIT_STUDENT_LRN
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={lrnInput}
                    onChange={(e) => setLrnInput(e.target.value.replace(/[^0-9?]/g, ""))}
                    className="w-full mt-1 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs font-mono font-bold text-[#FF7A00] focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">
                    STUDENT_NAME
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs uppercase text-white focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                      SECTION
                    </label>
                    <input
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs uppercase text-white focus:border-[#FF7A00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                      SUBJECT
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs uppercase text-white focus:border-[#FF7A00] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Direct Send to Scanner action button */}
            {onScanGeneratedSheet && (
              <div className="pt-2">
                <button
                  type="button"
                  id="feed-generated-sheet-to-scanner-btn"
                  onClick={() => onScanGeneratedSheet(previewDataUrl)}
                  className="w-full py-2.5 bg-[#FF7A00] text-black text-xs font-black uppercase tracking-wider rounded-xs shadow-[0_0_10px_#FF7A00] flex items-center justify-center space-x-2 transition-transform active:scale-95 hover:bg-[#FF8C1A]"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>FEED_INTO_OMR_SCANNER</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sheet Live Preview */}
        <div className="lg:col-span-7">
          <div className="bg-[#14171A] rounded-xs p-3.5 border border-[#272C33] flex flex-col items-center shadow-lg">
            <div className="w-full flex items-center justify-between pb-2 text-[10px] text-slate-400 border-b border-[#272C33] uppercase">
              <span>{sheetMode === "blank" ? "OFFICIAL_BLANK_BUBBLE_SHEET_60" : "CUSTOM_CALIBRATED_SHEET"}</span>
              <span className="text-[#FF7A00] font-bold">1467 × 2048 PX</span>
            </div>

            <div className="p-2 w-full flex justify-center overflow-auto max-h-[600px]">
              {isGenerating ? (
                <div className="py-20 text-slate-500 text-xs uppercase flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#FF7A00]" />
                  <span>PREPARING_SHEET_IMAGE...</span>
                </div>
              ) : previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Generated OMR Sheet"
                  className="max-h-[560px] w-auto object-contain rounded-xs shadow-xl bg-white"
                />
              ) : (
                <div className="py-20 text-slate-500 text-xs uppercase">RENDERING_PIXELS...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
