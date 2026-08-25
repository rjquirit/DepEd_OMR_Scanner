import React, { useState, useEffect, useRef } from "react";
import { Printer, Download, Sparkles, RefreshCw, CheckCircle2, Play, Sliders, Layers } from "lucide-react";
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
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");

  // Render sheet whenever inputs change
  useEffect(() => {
    const filledAnswers: Record<number, OptionType> = {};
    if (sheetMode === "sample_filled") {
      const pattern: OptionType[] = ["A", "B", "C", "D", "A", "C", "B", "D", "B", "A", "C", "D", "A", "B", "C"];
      for (let i = 1; i <= 60; i++) {
        filledAnswers[i] = pattern[(i - 1) % pattern.length];
      }
    }

    const canvas = generateOMRSheetCanvas({
      lrn: sheetMode === "sample_filled" ? lrnInput : "????????????",
      metadata: {
        name: sheetMode === "sample_filled" ? studentName : null,
        section: sheetMode === "sample_filled" ? section : null,
        school_id: sheetMode === "sample_filled" ? schoolId : null,
        grade_level: sheetMode === "sample_filled" ? gradeLevel : null,
        subject: sheetMode === "sample_filled" ? subject : null,
      },
      answers: filledAnswers,
      includeFiducials: true,
      addScanNoise: false,
    });

    setPreviewDataUrl(canvas.toDataURL("image/png"));
  }, [lrnInput, studentName, section, schoolId, gradeLevel, subject, sheetMode]);

  // Trigger browser print
  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Standard 60-Item OMR Answer Sheet</title>
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
    a.download = `OMR_Standard_60Item_Sheet_${sheetMode}.png`;
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
              CANVAS_ENGINE // VECTOR_SHEET_RENDERER
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
            <span>PRINTABLE_OMR_SHEET_GENERATOR</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Standard 60-item answer sheets with 12-digit LRN bubble grid and corner timing marks.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownload}
            className="px-3.5 py-2 bg-[#14171A] hover:bg-slate-800 text-slate-300 text-xs font-bold uppercase rounded-xs border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT_PNG</span>
          </button>

          <button
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
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              SHEET_PAYLOAD_CONFIGURATION
            </h3>

            {/* Mode Picker (Blank vs Pre-filled) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSheetMode("blank")}
                className={`py-2 px-2.5 rounded-xs text-xs font-bold uppercase border transition-all ${
                  sheetMode === "blank"
                    ? "bg-[#FF7A00] text-black border-[#FF7A00] shadow-[0_0_8px_rgba(255,122,0,0.3)] font-black"
                    : "bg-[#0D0F12] border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                BLANK_SHEET
              </button>

              <button
                type="button"
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

            {sheetMode === "sample_filled" && (
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
              <span>STANDARD_60_ITEM_A4_SHEET</span>
              <span className="text-[#FF7A00] font-bold">1600 × 2200 PX</span>
            </div>

            <div className="p-2 w-full flex justify-center overflow-auto max-h-[600px]">
              {previewDataUrl ? (
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
