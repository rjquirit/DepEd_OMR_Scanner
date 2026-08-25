import React, { useState } from "react";
import { KeyRound, X, Check, AlertTriangle, Layers, BookOpen, GraduationCap, Percent } from "lucide-react";
import { AnswerKey, OMRScanResult, OptionType } from "../../types";

interface SaveAsAnswerKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanResult: OMRScanResult;
  onSaveKey: (key: AnswerKey, makeActive?: boolean) => void;
}

export function SaveAsAnswerKeyModal({
  isOpen,
  onClose,
  scanResult,
  onSaveKey,
}: SaveAsAnswerKeyModalProps) {
  const defaultSubject = scanResult.metadata.subject || "GENERAL_EXAM";
  const defaultTitle = scanResult.metadata.subject
    ? `${scanResult.metadata.subject.toUpperCase()}_KEY_${new Date().toISOString().slice(0, 10)}`
    : `ANSWER_KEY_${new Date().toISOString().slice(0, 10)}`;
  const defaultGrade = scanResult.metadata.grade_level || "GRADE 10";

  const [title, setTitle] = useState(defaultTitle);
  const [subject, setSubject] = useState(defaultSubject);
  const [gradeLevel, setGradeLevel] = useState(defaultGrade);
  const [passingPercentage, setPassingPercentage] = useState(75);
  const [setAsActive, setSetAsActive] = useState(true);

  if (!isOpen) return null;

  // Compute stats from scanned answers
  let validCount = 0;
  let blankCount = 0;
  let multipleCount = 0;
  const keysMap: Record<number, "A" | "B" | "C" | "D"> = {};

  for (let i = 1; i <= 60; i++) {
    const matched = scanResult.answers.find((a) => a.item_number === i);
    const opt = matched?.selected_option;
    if (opt === "A" || opt === "B" || opt === "C" || opt === "D") {
      keysMap[i] = opt;
      validCount++;
    } else if (opt === "MULTIPLE") {
      keysMap[i] = "A"; // Default fallback
      multipleCount++;
    } else {
      keysMap[i] = "A"; // Default fallback for unshaded/blank
      blankCount++;
    }
  }

  const handleSave = () => {
    const newKey: AnswerKey = {
      id: "key-" + Date.now(),
      title: title.trim() || `ANSWER_KEY_${Date.now()}`,
      subject: subject.trim() || "GENERAL",
      grade_level: gradeLevel.trim() || "GRADE 10",
      created_at: new Date().toISOString(),
      passing_score_percentage: Math.min(100, Math.max(1, Number(passingPercentage) || 75)),
      total_items: 60,
      keys: keysMap,
    };

    onSaveKey(newKey, setAsActive);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono animate-in fade-in duration-150">
      <div
        id="save-as-answer-key-modal"
        className="bg-[#14171A] border border-amber-500/40 rounded-xs shadow-[0_0_30px_rgba(245,158,11,0.2)] w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#1C1F24] border-b border-[#272C33]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xs bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                SAVE_AS_ANSWER_KEY
              </h3>
              <p className="text-[11px] text-slate-400">
                Convert currently scanned 60-item bubble sheet into an active master answer key
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xs hover:bg-[#272C33] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Summary Box */}
          <div className="bg-[#0D0F12] border border-[#272C33] p-3.5 rounded-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">CAPTURED_ITEMS:</span>
              <span className="font-bold text-amber-400">60 ITEMS TOTAL</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#1C1F24] text-[11px]">
              <div className="bg-[#14171A] p-2 border border-emerald-900/40 rounded-xs">
                <span className="text-slate-400 block text-[9px]">RESOLVED</span>
                <span className="text-emerald-400 font-black text-sm">{validCount}</span>
              </div>
              <div className="bg-[#14171A] p-2 border border-amber-900/40 rounded-xs">
                <span className="text-slate-400 block text-[9px]">BLANK (DEF: A)</span>
                <span className="text-amber-400 font-black text-sm">{blankCount}</span>
              </div>
              <div className="bg-[#14171A] p-2 border border-rose-900/40 rounded-xs">
                <span className="text-slate-400 block text-[9px]">MULTIPLE (DEF: A)</span>
                <span className="text-rose-400 font-black text-sm">{multipleCount}</span>
              </div>
            </div>
            {(blankCount > 0 || multipleCount > 0) && (
              <div className="flex items-start space-x-2 text-[10px] text-amber-300/90 pt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  {blankCount + multipleCount} unshaded or ambiguous items will default to option "A". You can fine-tune individual options in the Answer Keys tab anytime.
                </span>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-amber-400" />
                <span>ANSWER_KEY_TITLE</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3_SCIENCE_PERIODICAL_TEST"
                className="w-full bg-[#0D0F12] border border-[#272C33] focus:border-amber-500 text-white text-xs px-3 py-2 rounded-xs outline-hidden transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-amber-400" />
                  <span>SUBJECT_NAME</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. MATHEMATICS"
                  className="w-full bg-[#0D0F12] border border-[#272C33] focus:border-amber-500 text-white text-xs px-3 py-2 rounded-xs outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3 h-3 text-amber-400" />
                  <span>GRADE_LEVEL</span>
                </label>
                <input
                  type="text"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="e.g. GRADE 10 - SECTION A"
                  className="w-full bg-[#0D0F12] border border-[#272C33] focus:border-amber-500 text-white text-xs px-3 py-2 rounded-xs outline-hidden transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                  <Percent className="w-3 h-3 text-amber-400" />
                  <span>PASSING_THRESHOLD (%)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={passingPercentage}
                  onChange={(e) => setPassingPercentage(Number(e.target.value))}
                  className="w-full bg-[#0D0F12] border border-[#272C33] focus:border-amber-500 text-white text-xs px-3 py-2 rounded-xs outline-hidden transition-colors"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={setAsActive}
                    onChange={(e) => setSetAsActive(e.target.checked)}
                    className="w-4 h-4 rounded-xs accent-amber-500 bg-[#0D0F12] border-slate-700 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300 font-bold">
                    SET_AS_ACTIVE_KEY
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 bg-[#1C1F24] border-t border-[#272C33] flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0D0F12] hover:bg-[#272C33] text-slate-300 text-xs font-bold border border-slate-700 rounded-xs uppercase tracking-wider transition-colors"
          >
            CANCEL
          </button>
          <button
            id="confirm-save-as-answer-key-btn"
            onClick={handleSave}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-xs flex items-center space-x-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)] active:scale-95 transition-all"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>SAVE_ANSWER_KEY</span>
          </button>
        </div>
      </div>
    </div>
  );
}
