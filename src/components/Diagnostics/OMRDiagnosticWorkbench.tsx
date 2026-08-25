import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  FileCode2,
  Filter,
  Layers,
  Sparkles,
  Target,
  Upload,
  Download,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  Cpu,
  RefreshCw,
  Search,
  Sliders,
  ShieldCheck,
  ChevronRight,
  Database,
  Trash2,
} from "lucide-react";
import {
  ErrorCategory,
  GroundTruthType,
  OMRDiagnosticRecord,
  OptionType,
  QuestionDiagnosticLog,
} from "../../types";
import {
  clearDiagnosticLogs,
  exportDiagnosticJson,
  exportDiagnosticJsonLines,
  loadDiagnosticRecords,
  recordDiagnosticLog,
  saveDiagnosticRecords,
  annotateGroundTruth,
} from "../../utils/omrDiagnosticLogger";
import {
  computeChoiceBiasStats,
  computeConfidenceCalibration,
  computeFeatureDistributions,
  computeQuestionAccuracyStats,
  computeRegionalStats,
  detectFailureSignatures,
  exportErrorCasesDataset,
  generateExecutiveSummary,
  generateRefinementProposalReport,
} from "../../utils/omrAnalysisEngine";
import { OMRErrorReviewModal } from "./OMRErrorReviewModal";

export function OMRDiagnosticWorkbench() {
  const [records, setRecords] = useState<OMRDiagnosticRecord[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"review" | "analytics" | "proposals" | "dataset">("review");
  const [filterErrorCategory, setFilterErrorCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State for inspecting a specific question
  const [inspectingQ, setInspectingQ] = useState<QuestionDiagnosticLog | null>(null);

  // Load records from storage on mount
  useEffect(() => {
    const loaded = loadDiagnosticRecords();
    setRecords(loaded);
    if (loaded.length > 0) {
      setSelectedScanId(loaded[loaded.length - 1].scanId);
    }
  }, []);

  const refreshLogs = () => {
    const loaded = loadDiagnosticRecords();
    setRecords(loaded);
    if (loaded.length > 0 && !selectedScanId) {
      setSelectedScanId(loaded[loaded.length - 1].scanId);
    }
  };

  const currentRecord = useMemo(() => {
    return records.find((r) => r.scanId === selectedScanId) || records[records.length - 1] || null;
  }, [records, selectedScanId]);

  // Analytics Computations
  const executiveSummary = useMemo(() => generateExecutiveSummary(records), [records]);
  const confidenceBins = useMemo(() => computeConfidenceCalibration(records), [records]);
  const questionStats = useMemo(() => computeQuestionAccuracyStats(records), [records]);
  const choiceBiases = useMemo(() => computeChoiceBiasStats(records), [records]);
  const regionalStats = useMemo(() => computeRegionalStats(records), [records]);
  const featureSummaries = useMemo(() => computeFeatureDistributions(records), [records]);
  const failureSignatures = useMemo(() => detectFailureSignatures(records), [records]);
  const refinementReport = useMemo(() => generateRefinementProposalReport(records), [records]);

  // Handle Quick Ground Truth Update directly from list
  const handleQuickLabel = (questionNum: number, actualMarked: GroundTruthType) => {
    if (!currentRecord) return;
    const updated = annotateGroundTruth(currentRecord.scanId, questionNum, actualMarked);
    if (updated) {
      refreshLogs();
    }
  };

  // Filtered Questions in Current Record
  const filteredQuestions = useMemo(() => {
    if (!currentRecord) return [];
    return currentRecord.questions.filter((q) => {
      // Error Category Filter
      if (filterErrorCategory !== "ALL") {
        if (filterErrorCategory === "LABELED_ERRORS") {
          if (!q.evaluation || q.evaluation.omrCorrect) return false;
        } else if (filterErrorCategory === "UNLABELED") {
          if (q.groundTruth) return false;
        } else if (filterErrorCategory === "AMBIGUOUS") {
          if (!q.ambiguous) return false;
        } else if (filterErrorCategory === "BLANKS") {
          if (!q.blank) return false;
        } else if (filterErrorCategory === "MULTIPLES") {
          if (!q.multiple) return false;
        } else {
          if (q.evaluation?.errorCategory !== filterErrorCategory) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQ = `q${q.question}`.includes(query) || `${q.question}`.includes(query);
        const matchesPred = q.predicted && q.predicted.toLowerCase().includes(query);
        const matchesTruth = q.groundTruth && q.groundTruth.actualMarked.toLowerCase().includes(query);
        if (!matchesQ && !matchesPred && !matchesTruth) return false;
      }

      return true;
    });
  }, [currentRecord, filterErrorCategory, searchQuery]);

  // Seed sample benchmark dataset if empty
  const handleSeedSampleDataset = () => {
    const sampleRecord: OMRDiagnosticRecord = {
      scanId: `OMR-${new Date().getFullYear()}-882910`,
      timestamp: new Date().toISOString(),
      engineVersion: "2.5.0",
      algorithmVersion: "TWO_ZONE_CIRCULAR_RELATIVE_V6",
      datasetSplit: "CALIBRATION",
      image: { width: 1600, height: 2200, format: "image/jpeg" },
      quality: {
        sharpness: 88.4,
        illuminationUniformity: 94.2,
        sheetCoverage: 98.6,
        fiducialConfidence: 0.98,
        homographyReprojectionError: 0.32,
        processingTimeMs: 46.2,
      },
      studentLrn: "123456789012",
      questions: Array.from({ length: 60 }, (_, idx) => {
        const qNum = idx + 1;
        const choices: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
        const chosen = choices[idx % 4];
        const isBlank = qNum % 15 === 0;
        const isMulti = qNum === 24;

        const choiceRecords: any = {};
        choices.forEach((c) => {
          const isWinner = c === chosen && !isBlank;
          const isSecond = isMulti && c === "B";
          const score = isWinner ? 0.48 : isSecond ? 0.38 : 0.04;

          choiceRecords[c] = {
            score,
            features: {
              innerMean: isWinner ? 65 : 215,
              ringMean: 225,
              contrast: isWinner ? 0.71 : 0.04,
              p10: isWinner ? 55 : 210,
              p20: isWinner ? 62 : 214,
              p30: isWinner ? 70 : 218,
              darkRatio: isWinner ? 0.85 : 0.02,
              filledAreaRatio: isWinner ? 0.85 : 0.02,
              largestComponentRatio: isWinner ? 0.82 : 0.0,
              componentCount: isWinner ? 1 : 0,
              centroidOffset: isWinner ? 0.45 : 0.0,
              centroidScore: 0.95,
              templateDifference: 0.05,
              finalScore: score,
            },
            geometry: {
              expectedX: 400 + (qNum > 20 ? 300 : 0),
              expectedY: 900 + (qNum % 20) * 50,
              actualX: 400 + (qNum > 20 ? 300 : 0),
              actualY: 900 + (qNum % 20) * 50,
              radius: 11,
              offsetX: 0,
              offsetY: 0,
            },
          };
        });

        const pred: OptionType = isBlank ? null : isMulti ? "MULTIPLE" : chosen;

        return {
          question: qNum,
          predicted: pred,
          confidence: isBlank ? 0.92 : isMulti ? 0.62 : 0.96,
          bestScore: isBlank ? 0.06 : 0.48,
          secondScore: isMulti ? 0.38 : 0.04,
          margin: isMulti ? 0.1 : 0.44,
          blank: isBlank,
          multiple: isMulti,
          ambiguous: isMulti,
          choices: choiceRecords,
          groundTruth:
            qNum <= 20
              ? {
                  actualMarked: pred === null ? "-" : (pred as GroundTruthType),
                  source: "human_verified" as const,
                  reviewedAt: new Date().toISOString(),
                }
              : undefined,
          evaluation:
            qNum <= 20
              ? {
                  omrCorrect: true,
                  errorCategory: isBlank
                    ? "CORRECT_BLANK"
                    : isMulti
                    ? "CORRECT_MULTIPLE"
                    : "TRUE_POSITIVE",
                }
              : undefined,
        };
      }),
    };

    recordDiagnosticLog(sampleRecord);
    refreshLogs();
  };

  const handleExportJson = () => {
    const json = exportDiagnosticJson(records);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deped_omr_diagnostics_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJsonLines = () => {
    const jsonl = exportDiagnosticJsonLines(records);
    const blob = new Blob([jsonl], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deped_omr_diagnostics_${new Date().toISOString().split("T")[0]}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportErrors = () => {
    const errorCases = exportErrorCasesDataset(records);
    const blob = new Blob([JSON.stringify(errorCases, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deped_omr_error_cases_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all OMR diagnostic logs? This cannot be undone.")) {
      clearDiagnosticLogs();
      setRecords([]);
      setSelectedScanId("");
    }
  };

  return (
    <div className="space-y-6 font-mono text-slate-200">
      {/* Top Banner & Scan Selector */}
      <div className="bg-[#14171D] border border-[#272C33] p-4 rounded-xs shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#FF7A00] rounded-xs shadow-[0_0_12px_#FF7A00]" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold uppercase tracking-wider text-white">
                  OMR_DIAGNOSTIC_WORKBENCH
                </h1>
                <span className="text-[10px] bg-[#FF7A00]/20 text-[#FF7A00] border border-[#FF7A00]/50 px-2 py-0.5 rounded-xs font-bold">
                  DATA-DRIVEN CV
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Full-Feature Logging &bull; Ground Truth Verification &bull; Failure Signatures &bull; Empirical Calibration
              </p>
            </div>
          </div>

          {/* Scan Picker & Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {records.length > 0 && (
              <select
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value)}
                className="bg-[#1C2027] border border-[#303742] text-xs text-white rounded-xs px-3 py-1.5 focus:outline-hidden focus:border-[#FF7A00]"
              >
                {records.map((r) => (
                  <option key={r.scanId} value={r.scanId}>
                    {r.scanId} ({new Date(r.timestamp).toLocaleTimeString()}) - {r.datasetSplit || "CALIB"}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={refreshLogs}
              className="p-1.5 rounded-xs bg-[#1C2027] hover:bg-[#252B35] border border-[#303742] text-slate-300 hover:text-white"
              title="Refresh Diagnostic Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {records.length === 0 && (
              <button
                onClick={handleSeedSampleDataset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[#FF7A00] text-black font-extrabold text-xs uppercase shadow-[0_0_10px_#FF7A00]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Load Sample Benchmark
              </button>
            )}
          </div>
        </div>

        {/* Executive KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-[#272C33]">
          <div className="bg-[#191D24] p-2.5 rounded-xs border border-[#272C33]">
            <span className="text-[10px] text-slate-400 uppercase block">Total Scans</span>
            <div className="text-lg font-bold text-white mt-0.5">{executiveSummary.totalScans}</div>
          </div>

          <div className="bg-[#191D24] p-2.5 rounded-xs border border-[#272C33]">
            <span className="text-[10px] text-slate-400 uppercase block">Evaluated Bubbles</span>
            <div className="text-lg font-bold text-[#FF7A00] mt-0.5">
              {executiveSummary.totalBubbles.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#191D24] p-2.5 rounded-xs border border-[#272C33]">
            <span className="text-[10px] text-slate-400 uppercase block">Verified Ground Truth</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {executiveSummary.totalLabeledQuestions} / {executiveSummary.totalQuestions}
            </div>
          </div>

          <div className="bg-[#191D24] p-2.5 rounded-xs border border-[#272C33]">
            <span className="text-[10px] text-slate-400 uppercase block">Empirical Accuracy</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {executiveSummary.overallOmrAccuracy}%
            </div>
          </div>

          <div className="bg-[#191D24] p-2.5 rounded-xs border border-[#272C33]">
            <span className="text-[10px] text-slate-400 uppercase block">Avg Quality / Sharpness</span>
            <div className="text-lg font-bold text-slate-200 mt-0.5">
              {executiveSummary.averageSharpness} / 100
            </div>
          </div>

          <div className="bg-[#191D24] p-2.5 rounded-xs border border-[#272C33]">
            <span className="text-[10px] text-slate-400 uppercase block">Avg Time per Sheet</span>
            <div className="text-lg font-bold text-slate-200 mt-0.5">
              {executiveSummary.averageProcessingTimeMs} ms
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-[#272C33] gap-2 text-xs">
        <button
          onClick={() => setActiveTab("review")}
          className={`flex items-center gap-2 px-4 py-2.5 uppercase font-bold border-b-2 transition-all ${
            activeTab === "review"
              ? "border-[#FF7A00] text-[#FF7A00] bg-[#FF7A00]/10"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          Ground Truth Annotator & Review
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-4 py-2.5 uppercase font-bold border-b-2 transition-all ${
            activeTab === "analytics"
              ? "border-[#FF7A00] text-[#FF7A00] bg-[#FF7A00]/10"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          CV Analytics & Error Mining
        </button>

        <button
          onClick={() => setActiveTab("proposals")}
          className={`flex items-center gap-2 px-4 py-2.5 uppercase font-bold border-b-2 transition-all ${
            activeTab === "proposals"
              ? "border-[#FF7A00] text-[#FF7A00] bg-[#FF7A00]/10"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Failure Signatures & Refinement Proposals
        </button>

        <button
          onClick={() => setActiveTab("dataset")}
          className={`flex items-center gap-2 px-4 py-2.5 uppercase font-bold border-b-2 transition-all ${
            activeTab === "dataset"
              ? "border-[#FF7A00] text-[#FF7A00] bg-[#FF7A00]/10"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Database className="w-4 h-4" />
          Dataset Splits & Export
        </button>
      </div>

      {/* TAB 1: GROUND TRUTH ANNOTATOR & INTERACTIVE REVIEW SCREEN */}
      {activeTab === "review" && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#14171D] p-3 rounded-xs border border-[#272C33]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Q# or Option..."
                  className="bg-[#1C2027] border border-[#303742] text-xs text-white rounded-xs pl-8 pr-3 py-1.5 w-48 focus:outline-hidden focus:border-[#FF7A00]"
                />
              </div>

              <select
                value={filterErrorCategory}
                onChange={(e) => setFilterErrorCategory(e.target.value)}
                className="bg-[#1C2027] border border-[#303742] text-xs text-white rounded-xs px-3 py-1.5 focus:outline-hidden focus:border-[#FF7A00]"
              >
                <option value="ALL">Show All Items (60)</option>
                <option value="UNLABELED">Unlabeled Ground Truth</option>
                <option value="LABELED_ERRORS">Verified Errors Only</option>
                <option value="AMBIGUOUS">Ambiguous / Close Runner-up</option>
                <option value="BLANKS">Blank Questions</option>
                <option value="MULTIPLES">Multiple Marks</option>
                <option value="WRONG_CHOICE">Wrong Choice (A vs B)</option>
                <option value="FALSE_BLANK">False Blank</option>
              </select>
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="text-white font-bold">{filteredQuestions.length}</span> of 60 items in{" "}
              <span className="text-[#FF7A00] font-bold">{currentRecord?.scanId || "None"}</span>
            </div>
          </div>

          {/* Interactive Review Table (Part 28 Architecture) */}
          <div className="bg-[#14171D] border border-[#272C33] rounded-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#191D24] text-slate-400 uppercase text-[10px] border-b border-[#272C33]">
                    <th className="py-2.5 px-3">Item #</th>
                    <th className="py-2.5 px-3">AI Prediction</th>
                    <th className="py-2.5 px-3">Conf</th>
                    <th className="py-2.5 px-3">Scores (A | B | C | D)</th>
                    <th className="py-2.5 px-3">Margin (&Delta;)</th>
                    <th className="py-2.5 px-3">Human Ground Truth</th>
                    <th className="py-2.5 px-3 text-center">Status / Error Cat</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20252E]">
                  {filteredQuestions.map((q) => {
                    const isEvaluated = !!q.groundTruth && !!q.evaluation;
                    const isCorrect = isEvaluated && q.evaluation?.omrCorrect;
                    const isError = isEvaluated && !q.evaluation?.omrCorrect;

                    return (
                      <tr
                        key={q.question}
                        className={`hover:bg-[#1A1F27] transition-colors ${
                          isError ? "bg-red-950/20" : q.ambiguous ? "bg-amber-950/15" : ""
                        }`}
                      >
                        {/* Question Number */}
                        <td className="py-2.5 px-3 font-bold text-white">Q{q.question}</td>

                        {/* Predicted */}
                        <td className="py-2.5 px-3">
                          {q.predicted === null ? (
                            <span className="text-slate-500 font-bold">BLANK (-)</span>
                          ) : q.predicted === "MULTIPLE" ? (
                            <span className="text-red-400 font-bold">MULTIPLE</span>
                          ) : (
                            <span className="text-[#FF7A00] font-bold text-sm">{q.predicted}</span>
                          )}
                        </td>

                        {/* Confidence */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold ${
                              q.confidence >= 0.8
                                ? "text-emerald-400"
                                : q.confidence >= 0.6
                                ? "text-amber-400"
                                : "text-red-400"
                            }`}
                          >
                            {Math.round(q.confidence * 100)}%
                          </span>
                        </td>

                        {/* Option Scores Matrix */}
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <div className="flex gap-2">
                            {(["A", "B", "C", "D"] as const).map((opt) => {
                              const s = q.choices[opt]?.score || 0;
                              const isWinner = q.predicted === opt;
                              return (
                                <span
                                  key={opt}
                                  className={`px-1.5 py-0.5 rounded-xs ${
                                    isWinner
                                      ? "bg-[#FF7A00] text-black font-bold"
                                      : s >= 0.2
                                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {opt}:{s.toFixed(2)}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Margin */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold ${
                              q.margin >= 0.10 ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {q.margin.toFixed(3)}
                          </span>
                        </td>

                        {/* Quick Ground Truth Annotation Buttons */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            {(["A", "B", "C", "D", "-"] as GroundTruthType[]).map((val) => {
                              const isCurrent = q.groundTruth?.actualMarked === val;
                              return (
                                <button
                                  key={val}
                                  onClick={() => handleQuickLabel(q.question, val)}
                                  className={`w-6 h-6 rounded-xs font-bold text-[10px] flex items-center justify-center transition-all ${
                                    isCurrent
                                      ? "bg-emerald-500 text-black shadow-[0_0_6px_#10B981]"
                                      : "bg-[#1C2027] text-slate-400 hover:text-white hover:bg-slate-700"
                                  }`}
                                  title={`Tag as ${val}`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* Evaluation Status */}
                        <td className="py-2.5 px-3 text-center">
                          {isEvaluated ? (
                            isCorrect ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                {q.evaluation?.errorCategory}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-red-950 text-red-300 text-[10px] font-bold border border-red-800">
                                <AlertTriangle className="w-3 h-3" />
                                {q.evaluation?.errorCategory}
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Unlabeled</span>
                          )}
                        </td>

                        {/* Inspect Details */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setInspectingQ(q)}
                            className="px-2.5 py-1 rounded-xs bg-[#1C2027] hover:bg-[#2A313C] text-slate-200 text-[11px] font-bold border border-[#303742] transition-colors"
                          >
                            Inspect &mu; / P20 &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CV ANALYTICS & ERROR MINING */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* 1. Confidence Calibration Bins Table */}
          <div className="bg-[#14171D] border border-[#272C33] p-4 rounded-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF7A00] mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Empirical Confidence Calibration (6 Standard Bins)
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Compares AI confidence rating against actual human-verified accuracy across all recorded items.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#191D24] text-slate-400 uppercase text-[10px] border-b border-[#272C33]">
                    <th className="py-2 px-3">Confidence Bin</th>
                    <th className="py-2 px-3 text-center">Total Predictions</th>
                    <th className="py-2 px-3 text-center">Correct</th>
                    <th className="py-2 px-3 text-center">Incorrect</th>
                    <th className="py-2 px-3 text-center">Unlabeled</th>
                    <th className="py-2 px-3 text-right">Empirical Error Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20252E]">
                  {confidenceBins.map((b) => (
                    <tr key={b.binRange} className="hover:bg-[#1A1F27]">
                      <td className="py-2 px-3 font-bold text-white">{b.binRange}</td>
                      <td className="py-2 px-3 text-center">{b.totalPredictions}</td>
                      <td className="py-2 px-3 text-center text-emerald-400 font-bold">{b.correctPredictions}</td>
                      <td className="py-2 px-3 text-center text-red-400 font-bold">{b.incorrectPredictions}</td>
                      <td className="py-2 px-3 text-center text-slate-500">{b.unlabeledCount}</td>
                      <td className="py-2 px-3 text-right font-bold">
                        <span
                          className={
                            b.empiricalErrorRate > 15
                              ? "text-red-400"
                              : b.empiricalErrorRate > 5
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }
                        >
                          {b.empiricalErrorRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Feature Distributions & Separability Ranking */}
          <div className="bg-[#14171D] border border-[#272C33] p-4 rounded-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF7A00] mb-1 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Feature Distribution & Separability (Fisher Criterion)
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Statistical ranking of computer vision features by their ability to distinguish true marks from smudges.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#191D24] text-slate-400 uppercase text-[10px] border-b border-[#272C33]">
                    <th className="py-2 px-3">Feature</th>
                    <th className="py-2 px-3 text-center">Correct Mark Mean (&mu; &plusmn; &sigma;)</th>
                    <th className="py-2 px-3 text-center">Error Mark Mean (&mu; &plusmn; &sigma;)</th>
                    <th className="py-2 px-3 text-center">Blank Paper Mean (&mu;)</th>
                    <th className="py-2 px-3 text-right">Separability Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20252E]">
                  {featureSummaries.map((f) => (
                    <tr key={f.featureName} className="hover:bg-[#1A1F27]">
                      <td className="py-2 px-3 font-bold text-white">{f.featureName}</td>
                      <td className="py-2 px-3 text-center text-emerald-400">
                        {f.correctMean} &plusmn; {f.correctStd}
                      </td>
                      <td className="py-2 px-3 text-center text-red-400">
                        {f.errorMean} &plusmn; {f.errorStd}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">{f.blankMean}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#FF7A00]">
                        {f.separabilityScore.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Choice Bias Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#14171D] border border-[#272C33] p-4 rounded-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
                Choice Precision & Recall Biases
              </h3>
              <div className="space-y-2">
                {choiceBiases.map((c) => (
                  <div key={c.choice} className="flex items-center justify-between p-2 bg-[#191D24] rounded-xs">
                    <span className="font-bold text-white w-16">{c.choice}</span>
                    <span className="text-[11px] text-slate-400">
                      Pred: {c.predictedCount} | Labeled: {c.labeledCount}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400">
                      Prec: {c.precision}% / Rec: {c.recall}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#14171D] border border-[#272C33] p-4 rounded-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
                Regional Layout & Column Biases
              </h3>
              <div className="space-y-2">
                {regionalStats.map((r) => (
                  <div key={r.region} className="flex items-center justify-between p-2 bg-[#191D24] rounded-xs">
                    <div>
                      <span className="font-bold text-white text-xs block">{r.description}</span>
                      <span className="text-[10px] text-slate-500">
                        {r.labeledQuestions} labeled items &bull; {r.errors} errors
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        r.errorRate > 5 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {r.errorRate}% Error
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FAILURE SIGNATURES & REFINEMENT PROPOSALS */}
      {activeTab === "proposals" && (
        <div className="space-y-6">
          {/* Failure Signatures Section */}
          <div className="bg-[#14171D] border border-[#272C33] p-4 rounded-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF7A00] mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Detected Multi-Feature Failure Signatures
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Automated pattern matching on failure cases across all recorded scans.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {failureSignatures.map((sig) => (
                <div key={sig.id} className="bg-[#191D24] border border-[#272C33] p-3.5 rounded-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{sig.name}</span>
                    <span className="px-2 py-0.5 rounded-xs bg-[#FF7A00]/20 text-[#FF7A00] font-bold text-[10px]">
                      {sig.occurrenceCount} matches
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    <span className="text-slate-500 block text-[10px] uppercase">Signature Pattern:</span>
                    <code>{sig.signaturePattern}</code>
                  </div>

                  <div className="text-[11px] bg-slate-900/80 p-2 rounded-xs border border-slate-800 text-slate-300">
                    <span className="text-emerald-400 font-bold block text-[10px] uppercase">Recommended Fix:</span>
                    {sig.recommendedFix}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Structured Refinement Proposals (Part 25 & 30-34) */}
          <div className="bg-[#14171D] border border-[#272C33] p-4 rounded-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#FF7A00]" />
                  Data-Driven Refinement Parameter Proposals
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{refinementReport.note}</p>
              </div>

              <span
                className={`px-2.5 py-1 rounded-xs font-bold text-[10px] uppercase ${
                  refinementReport.dataSufficiency === "HIGH"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                    : refinementReport.dataSufficiency === "MODERATE"
                    ? "bg-amber-950 text-amber-300 border border-amber-700"
                    : "bg-red-950 text-red-300 border border-red-700"
                }`}
              >
                Data Sufficiency: {refinementReport.dataSufficiency}
              </span>
            </div>

            {refinementReport.proposals.length > 0 ? (
              <div className="space-y-3">
                {refinementReport.proposals.map((prop, idx) => (
                  <div key={idx} className="bg-[#191D24] border border-[#272C33] p-4 rounded-xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-bold text-white text-xs">{prop.parameterName}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 line-through">{prop.currentValue}</span>
                        <span className="text-[#FF7A00] font-bold">&rarr; {prop.proposedValue}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Empirical Evidence:</span>
                        {prop.evidence}
                      </div>
                      <div>
                        <span className="text-emerald-400 block text-[10px] uppercase">Expected Benefit:</span>
                        {prop.expectedBenefit}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#272C33] text-[10px] text-slate-400">
                      <span>Regression Risk: <strong className="text-white">{prop.regressionRisk}</strong></span>
                      <span>Impact: <strong className="text-emerald-400">{prop.benchmarkImpact}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 bg-[#191D24] rounded-xs border border-dashed border-[#272C33]">
                <HelpCircle className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <p className="text-xs font-bold text-white">No Parameter Refinement Triggered Yet</p>
                <p className="text-[11px] mt-1 max-w-md mx-auto text-slate-400">
                  {refinementReport.note}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DATASET & EXPORT MANAGEMENT */}
      {activeTab === "dataset" && (
        <div className="space-y-6">
          <div className="bg-[#14171D] border border-[#272C33] p-4 rounded-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-[#FF7A00]" />
              Diagnostic Dataset Splits & Export Utilities
            </h3>
            <p className="text-[11px] text-slate-400">
              Manage your persistent OMR diagnostic logs and export standard datasets for calibration, validation, and C++ offline training.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#191D24] p-3 rounded-xs border border-[#272C33]">
                <span className="text-[10px] text-slate-400 block uppercase">Calibration Set (70%)</span>
                <div className="text-lg font-bold text-white mt-0.5">{executiveSummary.calibrationSetCount} scans</div>
                <span className="text-[10px] text-slate-500">Used for parameter tuning</span>
              </div>

              <div className="bg-[#191D24] p-3 rounded-xs border border-[#272C33]">
                <span className="text-[10px] text-slate-400 block uppercase">Validation Set (15%)</span>
                <div className="text-lg font-bold text-white mt-0.5">{executiveSummary.validationSetCount} scans</div>
                <span className="text-[10px] text-slate-500">Used for threshold evaluation</span>
              </div>

              <div className="bg-[#191D24] p-3 rounded-xs border border-[#272C33]">
                <span className="text-[10px] text-slate-400 block uppercase">Regression Set (15%)</span>
                <div className="text-lg font-bold text-white mt-0.5">{executiveSummary.regressionSetCount} scans</div>
                <span className="text-[10px] text-slate-500">Locked test set to prevent regressions</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-4 border-t border-[#272C33]">
              <button
                onClick={handleExportJson}
                className="flex items-center gap-2 px-3 py-2 rounded-xs bg-[#1C2027] hover:bg-[#272C33] text-white text-xs border border-[#303742]"
              >
                <Download className="w-3.5 h-3.5 text-[#FF7A00]" />
                Export Full Dataset (.JSON)
              </button>

              <button
                onClick={handleExportJsonLines}
                className="flex items-center gap-2 px-3 py-2 rounded-xs bg-[#1C2027] hover:bg-[#272C33] text-white text-xs border border-[#303742]"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export JSON Lines (.JSONL)
              </button>

              <button
                onClick={handleExportErrors}
                className="flex items-center gap-2 px-3 py-2 rounded-xs bg-[#1C2027] hover:bg-[#272C33] text-white text-xs border border-[#303742]"
              >
                <Download className="w-3.5 h-3.5 text-red-400" />
                Export Error Cases Only
              </button>

              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-3 py-2 rounded-xs bg-red-950/40 hover:bg-red-950 text-red-300 text-xs border border-red-800 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Dataset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Diagnostic Inspector Modal */}
      {inspectingQ && currentRecord && (
        <OMRErrorReviewModal
          scanId={currentRecord.scanId}
          question={inspectingQ}
          isOpen={!!inspectingQ}
          onClose={() => setInspectingQ(null)}
          onAnnotated={() => refreshLogs()}
        />
      )}
    </div>
  );
}
