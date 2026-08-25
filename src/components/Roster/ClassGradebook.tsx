import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  Download,
  FileSpreadsheet,
  Trash2,
  Eye,
  TrendingUp,
  Award,
  AlertOctagon,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { ScannedRecord } from "../../types";
import { exportRosterToCSV } from "../../utils/grading";

interface ClassGradebookProps {
  records: ScannedRecord[];
  onSelectRecord: (record: ScannedRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAllRecords: () => void;
}

export function ClassGradebook({
  records,
  onSelectRecord,
  onDeleteRecord,
  onClearAllRecords,
}: ClassGradebookProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");

  // Calculate distinct sections
  const sections = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.section) set.add(r.section);
    });
    return Array.from(set);
  }, [records]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.student_lrn.includes(searchTerm) ||
        (r.student_name && r.student_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.subject && r.subject.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchSection = sectionFilter === "all" || r.section === sectionFilter;

      return matchSearch && matchSection;
    });
  }, [records, searchTerm, sectionFilter]);

  // Compute aggregate statistics
  const stats = useMemo(() => {
    if (records.length === 0) {
      return { total: 0, average: 0, highest: 0, lowest: 0, passRate: 0 };
    }
    const scores = records.map((r) => r.score ?? 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / records.length) * 10) / 10;
    const passedCount = records.filter((r) => r.passed).length;
    const passRate = Math.round((passedCount / records.length) * 100);

    return {
      total: records.length,
      average: avg,
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
      passRate,
    };
  }, [records]);

  // Export to CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const csvContent = exportRosterToCSV(records);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OMR_Class_Roster_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export all to JSON
  const handleExportJSON = () => {
    if (records.length === 0) return;
    const jsonContent = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OMR_Class_Roster_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-mono">
      {/* Header with Export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#272C33] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-[#FF7A00] rounded-xs shadow-[0_0_6px_#FF7A00]" />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              CLASS_ROSTER // GRADEBOOK_TELEMETRY
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
            <span>BATCH_GRADEBOOK_REGISTRY</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Student assessment records, 12-digit LRN directory, and aggregated score metrics.
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="px-3.5 py-2 bg-[#FF7A00] text-black text-xs font-black uppercase rounded-xs shadow-[0_0_8px_#FF7A00] flex items-center space-x-1.5 transition-transform active:scale-95 disabled:opacity-40 hover:bg-[#FF8C1A]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>EXPORT_CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={records.length === 0}
            className="px-3.5 py-2 bg-[#14171A] hover:bg-slate-800 text-slate-300 text-xs font-bold uppercase rounded-xs border border-slate-700 flex items-center space-x-1.5 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT_JSON</span>
          </button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#14171A] p-3.5 rounded-xs border border-[#272C33] shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold">TOTAL_SCANNED</span>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </div>

        <div className="bg-[#14171A] p-3.5 rounded-xs border border-[#272C33] shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold">CLASS_AVERAGE</span>
          <p className="text-2xl font-black text-[#FF7A00] mt-1 drop-shadow-[0_0_8px_rgba(255,122,0,0.3)]">
            {stats.average} <span className="text-[10px] text-slate-500 font-bold">/ 60</span>
          </p>
        </div>

        <div className="bg-[#14171A] p-3.5 rounded-xs border border-[#272C33] shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold">PASS_RATE</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {stats.passRate}%
          </p>
        </div>

        <div className="bg-[#14171A] p-3.5 rounded-xs border border-[#272C33] shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold">HIGHEST_SCORE</span>
          <p className="text-2xl font-black text-[#FF7A00] mt-1">
            {stats.highest}
          </p>
        </div>

        <div className="bg-[#14171A] p-3.5 rounded-xs border border-[#272C33] shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold">LOWEST_SCORE</span>
          <p className="text-2xl font-black text-slate-400 mt-1">
            {stats.lowest}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#14171A] p-3 rounded-xs border border-[#272C33] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="SEARCH LRN, NAME, SUBJECT..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs text-slate-200 focus:border-[#FF7A00] focus:outline-none uppercase font-mono"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          {sections.length > 0 && (
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs text-slate-300 focus:border-[#FF7A00] focus:outline-none uppercase font-mono"
            >
              <option value="all">ALL_SECTIONS</option>
              {sections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          )}

          {records.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear all scanned records in this session?")) {
                  onClearAllRecords();
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2.5 py-1.5 bg-[#0D0F12] border border-slate-800 hover:border-rose-800 rounded-xs uppercase transition-colors"
            >
              CLEAR_ROSTER
            </button>
          )}
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-[#14171A] rounded-xs border border-[#272C33] overflow-hidden shadow-sm">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-700 mb-3" />
            <p className="font-bold text-slate-300 uppercase">NO_RECORDS_STORED</p>
            <p className="text-xs text-slate-500 mt-1">
              Capture or upload student sheets, then click "Save to Roster".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0D0F12] text-slate-400 font-bold uppercase border-b border-[#272C33]">
                <tr>
                  <th className="px-4 py-2.5">STUDENT_LRN</th>
                  <th className="px-4 py-2.5">STUDENT_NAME</th>
                  <th className="px-4 py-2.5">SECTION</th>
                  <th className="px-4 py-2.5">SUBJECT</th>
                  <th className="px-4 py-2.5 text-right">SCORE</th>
                  <th className="px-4 py-2.5 text-right">PERCENTAGE</th>
                  <th className="px-4 py-2.5 text-center">STATUS</th>
                  <th className="px-4 py-2.5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-[#1C1F24] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-bold text-[#FF7A00]">
                      {record.student_lrn}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-white uppercase">
                      {record.student_name || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 uppercase">{record.section || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400 uppercase">{record.subject || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-black text-white">
                      {record.score} / {record.total_items ?? 60}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-300">
                      {record.percentage}%
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.2 rounded-xs text-[9px] font-extrabold uppercase ${
                          record.passed
                            ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/50"
                            : "bg-rose-950/40 text-rose-300 border border-rose-500/50"
                        }`}
                      >
                        {record.passed ? "PASSED" : "FAILED"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-1">
                      <button
                        onClick={() => onSelectRecord(record)}
                        className="p-1 text-[#FF7A00] hover:text-white bg-[#0D0F12] border border-slate-700 hover:border-[#FF7A00]/50 rounded-xs transition-colors"
                        title="View Scan"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteRecord(record.id)}
                        className="p-1 text-rose-400 hover:text-rose-300 bg-[#0D0F12] border border-slate-700 hover:border-rose-700 rounded-xs transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
