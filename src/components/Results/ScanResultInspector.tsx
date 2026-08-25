import React, { useState } from "react";
import {
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Save,
  Copy,
  Download,
  Hash,
  Layers,
  Terminal,
  Activity,
  Sliders,
  KeyRound,
} from "lucide-react";
import confetti from "canvas-confetti";
import { AnswerKey, OMRScanResult, OptionType, QuestionDiagnosticLog, ScannedRecord } from "../../types";
import { gradeScanResult } from "../../utils/grading";
import { OMRErrorReviewModal } from "../Diagnostics/OMRErrorReviewModal";
import { SaveAsAnswerKeyModal } from "./SaveAsAnswerKeyModal";

interface ScanResultInspectorProps {
  scanResult: OMRScanResult;
  imageSrc?: string;
  activeAnswerKey: AnswerKey;
  onSaveToRoster: (record: ScannedRecord) => void;
  onSaveAsAnswerKey?: (key: AnswerKey, makeActive?: boolean) => void;
  onNewScan: () => void;
}

export function ScanResultInspector({
  scanResult,
  imageSrc,
  activeAnswerKey,
  onSaveToRoster,
  onSaveAsAnswerKey,
  onNewScan,
}: ScanResultInspectorProps) {
  const [currentResult, setCurrentResult] = useState<OMRScanResult>(scanResult);
  const [activeTab, setActiveTab] = useState<"matrix" | "lrn" | "json">("matrix");
  const [viewMode, setViewMode] = useState<"raw" | "diagnostics">(
    scanResult.debug_preview ? "diagnostics" : "raw"
  );
  const [copiedJson, setCopiedJson] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);
  const [isSaveKeyModalOpen, setIsSaveKeyModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [invertView, setInvertView] = useState(false);
  const [inspectingQ, setInspectingQ] = useState<QuestionDiagnosticLog | null>(null);

  // Compute grading against active answer key
  const grading = gradeScanResult(currentResult, activeAnswerKey);

  // Handle manual answer edit
  const handleAnswerOptionSelect = (itemNumber: number, option: OptionType) => {
    const updatedAnswers = currentResult.answers.map((ans) => {
      if (ans.item_number === itemNumber) {
        return {
          ...ans,
          selected_option: ans.selected_option === option ? null : option,
        };
      }
      return ans;
    });

    setCurrentResult({
      ...currentResult,
      answers: updatedAnswers,
    });
  };

  // Handle LRN single digit edit
  const handleLrnDigitChange = (index: number, val: string) => {
    const cleanVal = val.toUpperCase().slice(-1);
    const validChar = /^[0-9?]$/.test(cleanVal) ? cleanVal : "?";

    const lrnChars = currentResult.student_lrn.split("");
    while (lrnChars.length < 12) lrnChars.push("?");
    lrnChars[index] = validChar;

    setCurrentResult({
      ...currentResult,
      student_lrn: lrnChars.join(""),
    });
  };

  // Handle Metadata change
  const handleMetadataChange = (field: keyof OMRScanResult["metadata"], val: string) => {
    setCurrentResult({
      ...currentResult,
      metadata: {
        ...currentResult.metadata,
        [field]: val.trim() ? val : null,
      },
    });
  };

  // Copy JSON to clipboard
  const handleCopyJson = () => {
    const exportObj = {
      student_lrn: currentResult.student_lrn,
      metadata: currentResult.metadata,
      answers: currentResult.answers.map((a) => ({
        item_number: a.item_number,
        selected_option: a.selected_option,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(exportObj, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Download JSON file
  const handleDownloadJson = () => {
    const exportObj = {
      student_lrn: currentResult.student_lrn,
      metadata: currentResult.metadata,
      answers: currentResult.answers.map((a) => ({
        item_number: a.item_number,
        selected_option: a.selected_option,
      })),
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OMR_LRN_${currentResult.student_lrn}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save student scan to class roster / gradebook
  const handleSaveRecord = () => {
    const answersMap: Record<number, OptionType> = {};
    currentResult.answers.forEach((a) => {
      answersMap[a.item_number] = a.selected_option;
    });

    const newRecord: ScannedRecord = {
      id: "scan-" + Date.now(),
      timestamp: new Date().toISOString(),
      student_lrn: currentResult.student_lrn,
      student_name: currentResult.metadata.name || undefined,
      section: currentResult.metadata.section || undefined,
      subject: currentResult.metadata.subject || activeAnswerKey.subject,
      score: grading.score,
      total_items: grading.total_items,
      percentage: grading.percentage,
      passed: grading.passed,
      answers: answersMap,
      scanned_at: new Date().toISOString(),
      answer_key_id: activeAnswerKey.id,
      answer_key_title: activeAnswerKey.title,
      confidence_avg: currentResult.telemetry?.averageConfidence ? Math.round(currentResult.telemetry.averageConfidence * 100) : 95,
      diagnostic_scan_id: currentResult.telemetry?.scanId,
      scan_result: currentResult,
      image_preview: imageSrc,
    };

    onSaveToRoster(newRecord);
    setSavedSuccess(true);

    if (grading.passed && grading.percentage >= 80) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    }

    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Save scanned answers as master Answer Key
  const handleSaveAsKey = (newKey: AnswerKey, makeActive = true) => {
    if (onSaveAsAnswerKey) {
      onSaveAsAnswerKey(newKey, makeActive);
      setSavedKeySuccess(true);
      confetti({
        particleCount: 45,
        spread: 55,
        origin: { y: 0.6 },
      });
      setTimeout(() => setSavedKeySuccess(false), 3500);
    }
  };

  const optionLetters: OptionType[] = ["A", "B", "C", "D"];

  return (
    <div className="space-y-4 font-mono">
      {/* Top Banner: Student LRN HUD & Score Metric Block */}
      <div className="bg-[#14171A] border border-[#272C33] p-4 rounded-xs shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: LRN Array & Student Metadata */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                STUDENT_LRN_DETECTED
              </span>
              <span className="text-[9px] bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/40 px-1.5 py-0.2 font-bold">
                12_DIGIT_GRID
              </span>
            </div>

            {/* 12-Digit Quick Visual Array */}
            <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
              {currentResult.student_lrn.split("").map((digit, idx) => (
                <div
                  key={idx}
                  className={`w-7 h-9 sm:w-8 sm:h-10 bg-[#0D0F12] border flex items-center justify-center font-black text-sm sm:text-base shrink-0 ${
                    digit === "?"
                      ? "border-amber-500/60 text-amber-400"
                      : "border-[#FF7A00]/50 text-[#FF7A00] shadow-[0_0_8px_rgba(255,122,0,0.2)]"
                  }`}
                >
                  {digit}
                </div>
              ))}
            </div>

            {/* Metadata tags */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-slate-400 pt-1">
              <div>
                NAME: <span className="text-white font-bold">{currentResult.metadata.name || "UNFILLED"}</span>
              </div>
              <div className="text-slate-600 hidden sm:inline">|</div>
              <div>
                SEC: <span className="text-white">{currentResult.metadata.section || "—"}</span>
              </div>
              <div className="text-slate-600 hidden sm:inline">|</div>
              <div>
                SUBJ: <span className="text-white">{currentResult.metadata.subject || "—"}</span>
              </div>
            </div>
          </div>

          {/* Right: Score & Auto-Grading Widget */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-3 sm:space-x-4 bg-[#1C1F24] px-3.5 sm:px-4 py-2.5 border border-[#272C33] rounded-xs flex-1 sm:flex-initial">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  RAW_SCORE
                </div>
                <div className="flex items-baseline justify-end space-x-1">
                  <span className="text-2xl font-black text-[#FF7A00] drop-shadow-[0_0_8px_rgba(255,122,0,0.4)]">
                    {grading.score}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">/ {grading.total_items}</span>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800" />

              <div className="flex flex-col items-start">
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-xs border ${
                    grading.passed
                      ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/50 shadow-[0_0_6px_rgba(16,185,129,0.2)]"
                      : "bg-rose-950/40 text-rose-300 border-rose-500/50 shadow-[0_0_6px_rgba(244,63,94,0.2)]"
                  }`}
                >
                  {grading.percentage}% • {grading.passed ? "PASSED" : "FAILED"}
                </span>
                <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-1">
                  <span className="text-emerald-400">{grading.correct_count} C</span>
                  <span>•</span>
                  <span className="text-rose-400">{grading.incorrect_count} W</span>
                  {grading.unanswered_count > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-amber-400">{grading.unanswered_count} BLANK</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                id="save-to-roster-btn"
                onClick={handleSaveRecord}
                className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xs flex items-center justify-center space-x-1.5 transition-all min-h-[40px] ${
                  savedSuccess
                    ? "bg-emerald-500 text-black shadow-[0_0_10px_#10B981]"
                    : "bg-[#FF7A00] text-black shadow-[0_0_12px_#FF7A00] active:scale-95 hover:bg-[#FF8C1A]"
                }`}
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>SAVED_TO_ROSTER</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>SAVE_ROSTER</span>
                  </>
                )}
              </button>

              <button
                id="save-as-answer-key-btn"
                onClick={() => setIsSaveKeyModalOpen(true)}
                className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xs flex items-center justify-center space-x-1.5 transition-all min-h-[40px] border ${
                  savedKeySuccess
                    ? "bg-emerald-500 text-black border-emerald-400 shadow-[0_0_10px_#10B981]"
                    : "bg-[#1C1F24] hover:bg-[#272C33] text-amber-400 hover:text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.15)] active:scale-95"
                }`}
                title="Save scanned bubble sheet as a Master Answer Key"
              >
                {savedKeySuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>SAVED_AS_KEY</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>SAVE_ANSWER_KEYS</span>
                  </>
                )}
              </button>

              <button
                onClick={onNewScan}
                className="px-4 py-2.5 bg-[#0D0F12] hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 rounded-xs uppercase tracking-wider transition-colors min-h-[40px]"
              >
                NEXT_SCAN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Viewer & Right Tabbed Matrices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Image Viewer */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-[#14171A] border border-[#272C33] rounded-xs overflow-hidden flex flex-col">
            {/* Viewer Controls Header */}
            <div className="p-2 bg-[#1C1F24] border-b border-[#272C33] flex items-center justify-between text-xs gap-2 flex-wrap">
              <div className="flex items-center space-x-1 bg-[#0D0F12] p-0.5 border border-slate-800 rounded-xs">
                <button
                  onClick={() => setViewMode("raw")}
                  className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-all ${
                    viewMode === "raw"
                      ? "bg-[#FF7A00] text-black"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  RAW_FEED
                </button>
                {currentResult.debug_preview && (
                  <button
                    onClick={() => setViewMode("diagnostics")}
                    className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-all flex items-center space-x-1 ${
                      viewMode === "diagnostics"
                        ? "bg-emerald-500 text-black font-black shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        : "text-emerald-400 hover:text-white"
                    }`}
                  >
                    <span>CV_DIAGNOSTICS</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(0.7, prev - 0.2))}
                  className="p-1.5 rounded-xs bg-[#0D0F12] border border-slate-700 hover:border-[#FF7A00]/50 text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-slate-400 px-1">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(2.5, prev + 0.2))}
                  className="p-1.5 rounded-xs bg-[#0D0F12] border border-slate-700 hover:border-[#FF7A00]/50 text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setInvertView(false);
                  }}
                  className="p-1.5 rounded-xs bg-[#0D0F12] border border-slate-700 hover:border-[#FF7A00]/50 text-slate-300"
                  title="Reset View"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Viewer Canvas Area */}
            <div className="relative h-[320px] sm:h-[440px] bg-[#0D0F12] overflow-auto flex items-center justify-center p-2 border-b border-[#272C33]">
              {(viewMode === "diagnostics" && currentResult.debug_preview) || imageSrc ? (
                <img
                  src={
                    viewMode === "diagnostics" && currentResult.debug_preview
                      ? currentResult.debug_preview
                      : imageSrc
                  }
                  alt="Scanned OMR Document"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    filter: invertView ? "invert(1) contrast(1.4)" : "none",
                    transformOrigin: "top center",
                  }}
                  className="max-w-full h-auto object-contain transition-transform duration-150"
                />
              ) : (
                <div className="text-center p-6 text-slate-500 text-xs uppercase">
                  NO_OPTICAL_FEED_DATA
                </div>
              )}
            </div>

            {/* Metadata Fields Form */}
            <div className="p-3.5 bg-[#14171A] space-y-2">
              <div className="text-[9px] text-[#FF7A00] uppercase tracking-widest font-bold">
                METADATA_ATTRIBUTES_OVERRIDE
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[9px] text-slate-400 uppercase font-bold">STUDENT_NAME</label>
                  <input
                    type="text"
                    value={currentResult.metadata.name || ""}
                    onChange={(e) => handleMetadataChange("name", e.target.value)}
                    placeholder="NAME..."
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-slate-200 text-xs font-mono focus:border-[#FF7A00] focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 uppercase font-bold">SECTION</label>
                  <input
                    type="text"
                    value={currentResult.metadata.section || ""}
                    onChange={(e) => handleMetadataChange("section", e.target.value)}
                    placeholder="SECTION..."
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-slate-200 text-xs font-mono focus:border-[#FF7A00] focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 uppercase font-bold">SCHOOL_ID</label>
                  <input
                    type="text"
                    value={currentResult.metadata.school_id || ""}
                    onChange={(e) => handleMetadataChange("school_id", e.target.value)}
                    placeholder="SCHOOL_ID..."
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-slate-200 text-xs font-mono focus:border-[#FF7A00] focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 uppercase font-bold">SUBJECT</label>
                  <input
                    type="text"
                    value={currentResult.metadata.subject || ""}
                    onChange={(e) => handleMetadataChange("subject", e.target.value)}
                    placeholder="SUBJECT..."
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-slate-200 text-xs font-mono focus:border-[#FF7A00] focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Inspector (60-Item Answer Matrix, 12-Digit LRN, Standard JSON) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-[#14171A] border border-[#272C33] rounded-xs flex flex-col h-full">
            {/* Inspector Navigation Tabs */}
            <div className="p-2.5 bg-[#1C1F24] border-b border-[#272C33] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-1 bg-[#0D0F12] p-0.5 border border-slate-800 rounded-xs">
                <button
                  id="tab-answers-matrix-btn"
                  onClick={() => setActiveTab("matrix")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xs transition-all ${
                    activeTab === "matrix"
                      ? "bg-[#FF7A00] text-black shadow-[0_0_8px_rgba(255,122,0,0.3)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  60_ITEM_MATRIX
                </button>

                <button
                  id="tab-lrn-grid-btn"
                  onClick={() => setActiveTab("lrn")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xs transition-all ${
                    activeTab === "lrn"
                      ? "bg-[#FF7A00] text-black shadow-[0_0_8px_rgba(255,122,0,0.3)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  LRN_12_GRID
                </button>

                <button
                  id="tab-raw-json-btn"
                  onClick={() => setActiveTab("json")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xs transition-all ${
                    activeTab === "json"
                      ? "bg-[#FF7A00] text-black shadow-[0_0_8px_rgba(255,122,0,0.3)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  OUTPUT_JSON
                </button>
              </div>

              {/* JSON export buttons */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleCopyJson}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-[#0D0F12] border border-slate-700 hover:border-[#FF7A00]/50 rounded-xs flex items-center space-x-1 uppercase transition-colors"
                  title="Copy JSON Payload"
                >
                  {copiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedJson ? "COPIED" : "COPY_JSON"}</span>
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-[#0D0F12] border border-slate-700 hover:border-[#FF7A00]/50 rounded-xs flex items-center space-x-1 uppercase transition-colors"
                  title="Download JSON File"
                >
                  <Download className="w-3 h-3" />
                  <span>EXPORT</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: 60-Item Answer Matrix */}
            {activeTab === "matrix" && (
              <div className="p-3.5 flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-[#272C33] pb-2">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-xs bg-emerald-400 shadow-[0_0_4px_#10B981]" />
                      <span>CORRECT</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-xs bg-rose-500 shadow-[0_0_4px_#f43f5e]" />
                      <span>INCORRECT</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-xs bg-amber-400 shadow-[0_0_4px_#f59e0b]" />
                      <span>BLANK</span>
                    </span>
                  </div>
                  <span className="text-[#FF7A00] font-bold">60 / 60 PARSED</span>
                </div>

                {/* 3-Column Top & Bottom Technical Grid (Matching Physical Answer Sheet Layout) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 flex-1">
                  {[
                    {
                      colName: "COLUMN 1",
                      top: { title: "LEFT TOP (Q01 – Q10)", startItem: 1 },
                      bottom: { title: "LEFT BOTTOM (Q31 – Q40)", startItem: 31 },
                    },
                    {
                      colName: "COLUMN 2",
                      top: { title: "CENTER TOP (Q11 – Q20)", startItem: 11 },
                      bottom: { title: "CENTER BOTTOM (Q41 – Q50)", startItem: 41 },
                    },
                    {
                      colName: "COLUMN 3",
                      top: { title: "RIGHT TOP (Q21 – Q30)", startItem: 21 },
                      bottom: { title: "RIGHT BOTTOM (Q51 – Q60)", startItem: 51 },
                    },
                  ].map((col, colIdx) => {
                    const sections = [
                      { title: col.top.title, startItem: col.top.startItem },
                      { title: col.bottom.title, startItem: col.bottom.startItem },
                    ];

                    return (
                      <div key={colIdx} className="space-y-2.5">
                        {sections.map((sec, secIdx) => (
                          <div
                            key={secIdx}
                            className="bg-[#0D0F12] border border-[#272C33] p-2 space-y-1 rounded-xs"
                          >
                            <div className="text-[9px] font-bold text-slate-400 pb-1 border-b border-[#272C33] flex justify-between uppercase">
                              <span>{sec.title}</span>
                              <span>A B C D</span>
                            </div>

                            {Array.from({ length: 10 }, (_, i) => {
                              const itemNum = sec.startItem + i;
                              const ansObj = currentResult.answers.find((a) => a.item_number === itemNum);
                              const selected = ansObj?.selected_option || null;
                              const gradingItem = grading.items.find((g) => g.item_number === itemNum);

                              const isCorrect = gradingItem?.is_correct;
                              const isWrong = gradingItem?.status === "incorrect";
                              const isMultiple = selected === "MULTIPLE";
                              const isBlank = selected === null;

                              return (
                                <div
                                  key={itemNum}
                                  className={`flex items-center justify-between px-1.5 py-0.5 border-b border-slate-800/40 transition-colors ${
                                    isCorrect
                                      ? "bg-emerald-950/25"
                                      : isWrong
                                      ? "bg-rose-950/25"
                                      : isMultiple || isBlank
                                      ? "bg-amber-950/20"
                                      : ""
                                  }`}
                                >
                                  {/* Item Number */}
                                  <div className="flex items-center space-x-1 min-w-[32px]">
                                    <span className="font-mono text-[10px] text-slate-400">
                                      {itemNum < 10 ? `0${itemNum}` : itemNum}.
                                    </span>
                                    {isCorrect && <span className="text-[9px] text-emerald-400 font-black">✓</span>}
                                    {isWrong && <span className="text-[9px] text-rose-400 font-black">✕</span>}
                                  </div>

                                  {/* A, B, C, D Bubble Buttons */}
                                  <div className="flex items-center space-x-1">
                                    {optionLetters.map((opt) => {
                                      const isOptionSelected = selected === opt;
                                      const isKeyAnswer = gradingItem?.correct_answer === opt;

                                      return (
                                        <button
                                          key={opt}
                                          onClick={() => handleAnswerOptionSelect(itemNum, opt)}
                                          className={`w-5 h-5 rounded-xs text-[9px] font-black transition-all flex items-center justify-center ${
                                            isOptionSelected
                                              ? isCorrect
                                                ? "bg-emerald-500 text-black font-black shadow-[0_0_6px_#10B981]"
                                                : "bg-[#FF7A00] text-black font-black shadow-[0_0_6px_#FF7A00]"
                                              : isKeyAnswer && isWrong
                                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500"
                                              : "bg-[#1C1F24] text-slate-400 border border-slate-700 hover:border-[#FF7A00]/60"
                                          }`}
                                        >
                                          {opt}
                                        </button>
                                      );
                                    })}

                                    {isMultiple && (
                                      <span className="px-1 text-[8px] font-bold bg-amber-500 text-black rounded-xs">
                                        MULTI
                                      </span>
                                    )}

                                    {/* Diagnostic Inspection Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const diag =
                                          ansObj?.diagnostic ||
                                          currentResult.diagnostic_record?.questions.find((q) => q.question === itemNum);
                                        if (diag) {
                                          setInspectingQ(diag);
                                        }
                                      }}
                                      className="p-0.5 text-slate-500 hover:text-[#FF7A00] transition-colors"
                                      title={`Inspect CV features & Ground Truth for Q${itemNum}`}
                                    >
                                      <Sliders className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: 12-Digit Student LRN Grid */}
            {activeTab === "lrn" && (
              <div className="p-4 flex-1 space-y-4">
                <div className="flex items-center justify-between border-b border-[#272C33] pb-2">
                  <div className="flex items-center space-x-2">
                    <Hash className="w-4 h-4 text-[#FF7A00]" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      STUDENT_LRN // 12_DIGIT_GRID_RECONSTRUCTION
                    </h4>
                  </div>
                  <span className="text-[10px] text-[#FF7A00] font-bold">COLUMNS 1 TO 12</span>
                </div>

                {/* 12-Digit Character Boxes */}
                <div className="flex justify-between items-center gap-1 sm:gap-1.5 p-3 bg-[#0D0F12] border border-[#272C33] rounded-xs overflow-x-auto">
                  {Array.from({ length: 12 }, (_, i) => {
                    const char = currentResult.student_lrn[i] || "?";
                    const isAmbiguous = char === "?";

                    return (
                      <div key={i} className="flex-1 min-w-[22px] flex flex-col items-center">
                        <span className="text-[9px] text-slate-500 font-mono mb-1">C{i + 1}</span>
                        <input
                          type="text"
                          maxLength={1}
                          value={char}
                          onChange={(e) => handleLrnDigitChange(i, e.target.value)}
                          className={`w-full text-center font-mono font-black text-xs sm:text-sm py-1 border rounded-xs focus:border-[#FF7A00] focus:outline-none ${
                            isAmbiguous
                              ? "bg-amber-950/40 border-amber-500 text-amber-400"
                              : "bg-[#1C1F24] border-slate-700 text-[#FF7A00]"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* 12x10 Bubble Matrix */}
                <div className="bg-[#0D0F12] text-white rounded-xs p-3 border border-[#272C33] space-y-1.5 overflow-x-auto">
                  <div className="text-[10px] font-bold text-slate-400 pb-1.5 border-b border-[#272C33] flex justify-between uppercase">
                    <span>12_COLUMN_OPTICAL_MATRIX</span>
                    <span>ROW = DIGIT_0_TO_9</span>
                  </div>

                  {Array.from({ length: 10 }, (_, rowDigit) => (
                    <div key={rowDigit} className="flex items-center gap-1.5 min-w-[320px]">
                      <span className="w-4 text-right font-mono text-[10px] font-bold text-slate-500">
                        {rowDigit}
                      </span>

                      <div className="flex-1 flex justify-between gap-1">
                        {Array.from({ length: 12 }, (_, colIdx) => {
                          const char = currentResult.student_lrn[colIdx];
                          const isFilled = char === rowDigit.toString();

                          return (
                            <div
                              key={colIdx}
                              onClick={() => handleLrnDigitChange(colIdx, rowDigit.toString())}
                              className={`flex-1 aspect-square max-w-[26px] rounded-xs flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform ${
                                isFilled
                                  ? "bg-[#FF7A00] text-black shadow-[0_0_8px_#FF7A00]"
                                  : "bg-[#1C1F24] text-slate-400 hover:bg-slate-800 border border-slate-800"
                              }`}
                              title={`Column ${colIdx + 1}, Digit ${rowDigit}`}
                            >
                              {rowDigit}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: Output JSON */}
            {activeTab === "json" && (
              <div className="p-3.5 flex-1 flex flex-col space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-[#FF7A00] font-bold">SCHEMA: STANDARDIZED_OMR_V2</span>
                  <span>{currentResult.answers.length} ITEMS_BUFFERED</span>
                </div>

                <pre className="flex-1 p-3 bg-[#0D0F12] text-[#FF7A00] font-mono text-xs rounded-xs overflow-auto border border-[#272C33] max-h-[460px]">
                  {JSON.stringify(
                    {
                      student_lrn: currentResult.student_lrn,
                      metadata: currentResult.metadata,
                      answers: currentResult.answers.map((a) => ({
                        item_number: a.item_number,
                        selected_option: a.selected_option,
                      })),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Question Diagnostic Inspector Modal */}
      {inspectingQ && (
        <OMRErrorReviewModal
          scanId={currentResult.telemetry?.scanId || currentResult.diagnostic_record?.scanId || "LOCAL_SCAN"}
          question={inspectingQ}
          isOpen={!!inspectingQ}
          onClose={() => setInspectingQ(null)}
          onAnnotated={(updated) => {
            // Update local state if needed
            if (updated.predicted !== undefined) {
              const updatedAnswers = currentResult.answers.map((ans) => {
                if (ans.item_number === updated.question) {
                  return {
                    ...ans,
                    diagnostic: updated,
                  };
                }
                return ans;
              });
              setCurrentResult({
                ...currentResult,
                answers: updatedAnswers,
              });
            }
          }}
        />
      )}

      {/* Save As Answer Key Modal */}
      <SaveAsAnswerKeyModal
        isOpen={isSaveKeyModalOpen}
        onClose={() => setIsSaveKeyModalOpen(false)}
        scanResult={currentResult}
        onSaveKey={handleSaveAsKey}
      />
    </div>
  );
}
