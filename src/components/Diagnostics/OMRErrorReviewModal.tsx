import { useState } from "react";
import { X, CheckCircle2, AlertTriangle, HelpCircle, Save, Info, Sliders, ShieldCheck } from "lucide-react";
import { GroundTruthType, OptionType, QuestionDiagnosticLog } from "../../types";
import { annotateGroundTruth } from "../../utils/omrDiagnosticLogger";

interface OMRErrorReviewModalProps {
  scanId: string;
  question: QuestionDiagnosticLog;
  isOpen: boolean;
  onClose: () => void;
  onAnnotated?: (updated: QuestionDiagnosticLog) => void;
}

export function OMRErrorReviewModal({
  scanId,
  question,
  isOpen,
  onClose,
  onAnnotated,
}: OMRErrorReviewModalProps) {
  const [selectedGroundTruth, setSelectedGroundTruth] = useState<GroundTruthType>(
    question.groundTruth?.actualMarked || (question.predicted === null ? "-" : (question.predicted as GroundTruthType))
  );
  const [notes, setNotes] = useState<string>(question.groundTruth?.notes || "");
  const [activeTab, setActiveTab] = useState<"features" | "geometry">("features");

  if (!isOpen) return null;

  const opts = ["A", "B", "C", "D"] as const;

  const handleSave = () => {
    const updatedRecord = annotateGroundTruth(scanId, question.question, selectedGroundTruth, notes);
    if (updatedRecord) {
      const updatedQ = updatedRecord.questions.find((q) => q.question === question.question);
      if (updatedQ && onAnnotated) {
        onAnnotated(updatedQ);
      }
    }
    onClose();
  };

  const getPredictionBadge = (pred: OptionType) => {
    if (pred === null) return <span className="text-slate-400 font-bold font-mono">BLANK (-)</span>;
    if (pred === "MULTIPLE") return <span className="text-red-400 font-bold font-mono">MULTIPLE</span>;
    return <span className="text-[#FF7A00] font-bold font-mono text-base">{pred}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181C22] border border-[#2B323D] rounded-xs shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2B323D] bg-[#14171D]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-xs bg-[#FF7A00] shadow-[0_0_8px_#FF7A00]" />
            <div>
              <h3 className="text-sm font-bold tracking-wider uppercase font-mono text-white flex items-center gap-2">
                QUESTION #{question.question} DIAGNOSTIC INSPECTOR
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                SCAN_ID: <span className="text-[#FF7A00]">{scanId}</span> &bull; ENGINE:{" "}
                <span className="text-emerald-400">TWO-ZONE CV v2.5.0</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 font-mono text-xs">
          {/* Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#1F242D] border border-[#2B323D] p-3 rounded-xs">
              <span className="text-[10px] text-slate-400 block uppercase">OMR Prediction</span>
              <div className="mt-1 flex items-center gap-2">
                {getPredictionBadge(question.predicted)}
                <span className="text-[10px] text-slate-400">({Math.round(question.confidence * 100)}% conf)</span>
              </div>
            </div>

            <div className="bg-[#1F242D] border border-[#2B323D] p-3 rounded-xs">
              <span className="text-[10px] text-slate-400 block uppercase">Best Score</span>
              <div className="mt-1 text-emerald-400 font-bold text-base">{question.bestScore.toFixed(3)}</div>
            </div>

            <div className="bg-[#1F242D] border border-[#2B323D] p-3 rounded-xs">
              <span className="text-[10px] text-slate-400 block uppercase">2nd Runner-up</span>
              <div className="mt-1 text-slate-300 font-bold text-base">{question.secondScore.toFixed(3)}</div>
            </div>

            <div className="bg-[#1F242D] border border-[#2B323D] p-3 rounded-xs">
              <span className="text-[10px] text-slate-400 block uppercase">Victory Margin (&Delta;)</span>
              <div
                className={`mt-1 font-bold text-base ${
                  question.margin >= 0.1 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {question.margin.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Choice Scores Comparison Bars */}
          <div className="bg-[#1F242D] border border-[#2B323D] p-4 rounded-xs">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Option Score Comparison (A, B, C, D)
              </span>
              <span className="text-[10px] text-slate-400">Threshold: minScore = 0.200</span>
            </div>

            <div className="space-y-2">
              {opts.map((opt) => {
                const choice = question.choices[opt];
                const score = choice ? choice.score : 0;
                const isPredicted = question.predicted === opt;
                const percent = Math.min(100, Math.max(0, score * 100));

                return (
                  <div key={opt} className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-xs font-bold text-xs ${
                        isPredicted ? "bg-[#FF7A00] text-black shadow-[0_0_8px_#FF7A00]" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {opt}
                    </span>
                    <div className="flex-1 bg-slate-900 h-4 rounded-xs overflow-hidden relative border border-slate-700/50">
                      <div
                        className={`h-full transition-all ${
                          isPredicted ? "bg-[#FF7A00]" : score >= 0.2 ? "bg-amber-500" : "bg-slate-600"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                      {/* Threshold marker at 20% */}
                      <div className="absolute top-0 bottom-0 left-[20%] w-[1px] bg-red-500/60" />
                    </div>
                    <span className="w-14 text-right font-mono font-bold text-slate-200">{score.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Features Comparison Matrix */}
          <div className="bg-[#1F242D] border border-[#2B323D] rounded-xs overflow-hidden">
            <div className="flex border-b border-[#2B323D] bg-[#14171D] px-3 py-2 justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("features")}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-xs ${
                    activeTab === "features" ? "bg-[#FF7A00] text-black" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Extracted CV Features
                </button>
                <button
                  onClick={() => setActiveTab("geometry")}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-xs ${
                    activeTab === "geometry" ? "bg-[#FF7A00] text-black" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Spatial Geometry & Offset
                </button>
              </div>
              <span className="text-[10px] text-slate-500">2-Zone Math</span>
            </div>

            <div className="overflow-x-auto p-2">
              {activeTab === "features" ? (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#2B323D] text-slate-400">
                      <th className="py-1.5 px-2">Feature Name</th>
                      {opts.map((opt) => (
                        <th key={opt} className="py-1.5 px-2 text-center">
                          Option {opt}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Inner Core Mean (&mu;inner)</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.features.innerMean ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Paper Ring Mean (&mu;ring)</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.features.ringMean ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Relative Contrast</td>
                      {opts.map((opt) => (
                        <td
                          key={opt}
                          className={`py-1.5 px-2 text-center font-bold ${
                            (question.choices[opt]?.features.contrast || 0) >= 0.25 ? "text-emerald-400" : ""
                          }`}
                        >
                          {question.choices[opt]?.features.contrast.toFixed(3) ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Adaptive Dark Ratio</td>
                      {opts.map((opt) => (
                        <td
                          key={opt}
                          className={`py-1.5 px-2 text-center font-bold ${
                            (question.choices[opt]?.features.darkRatio || 0) >= 0.35 ? "text-emerald-400" : ""
                          }`}
                        >
                          {question.choices[opt]?.features.darkRatio.toFixed(3) ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">P20 Percentile Darkness</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.features.p20 ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Connected Comp Count</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.features.componentCount ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Largest Comp Ratio</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.features.largestComponentRatio.toFixed(3) ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Centroid Offset (px)</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.features.centroidOffset.toFixed(2) ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-slate-900/60 font-bold">
                      <td className="py-1.5 px-2 text-white">Final Weighted Score</td>
                      {opts.map((opt) => (
                        <td
                          key={opt}
                          className={`py-1.5 px-2 text-center ${
                            question.predicted === opt ? "text-[#FF7A00]" : "text-slate-300"
                          }`}
                        >
                          {question.choices[opt]?.features.finalScore.toFixed(3) ?? "-"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#2B323D] text-slate-400">
                      <th className="py-1.5 px-2">Metric</th>
                      {opts.map((opt) => (
                        <th key={opt} className="py-1.5 px-2 text-center">
                          Option {opt}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Expected (Canonical) X</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.geometry.expectedX ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Actual Sampled X</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.geometry.actualX ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Sampled Y</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.geometry.actualY ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">Radius</td>
                      {opts.map((opt) => (
                        <td key={opt} className="py-1.5 px-2 text-center">
                          {question.choices[opt]?.geometry.radius ?? "-"} px
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Human Ground Truth Verification Panel */}
          <div className="bg-[#1F242D] border-2 border-[#FF7A00]/40 p-4 rounded-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#FF7A00]" />
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Human Ground Truth Annotation
                </span>
              </div>
              {question.groundTruth && (
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-xs">
                  VERIFIED: {question.groundTruth.actualMarked}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Select the true visual state of the bubble on the physical paper to train error categorization:
            </p>

            {/* Fast Selection Buttons */}
            <div className="flex flex-wrap gap-2">
              {(["A", "B", "C", "D", "-", "MULTIPLE", "AMBIGUOUS"] as GroundTruthType[]).map((val) => {
                const isSelected = selectedGroundTruth === val;
                const label = val === "-" ? "BLANK (-)" : val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSelectedGroundTruth(val)}
                    className={`px-3 py-1.5 rounded-xs font-bold text-xs uppercase transition-all min-h-[34px] ${
                      isSelected
                        ? "bg-[#FF7A00] text-black shadow-[0_0_10px_#FF7A00]"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Notes / Reason */}
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 uppercase">Reviewer Remarks / Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Light 2B pencil mark, stray smudge on option C, partial erasure"
                className="w-full bg-[#14171D] border border-slate-700 rounded-xs px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#FF7A00]"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2B323D] bg-[#14171D]">
          <span className="text-[10px] text-slate-500 font-mono">
            Ground Truth will be stored in immutable diagnostic dataset
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xs bg-[#FF7A00] hover:bg-[#FF8C1A] text-black font-extrabold font-mono text-xs uppercase shadow-[0_0_10px_#FF7A00]"
            >
              <Save className="w-3.5 h-3.5" />
              Save Ground Truth
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
