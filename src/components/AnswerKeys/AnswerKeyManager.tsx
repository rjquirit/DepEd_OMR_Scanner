import React, { useState } from "react";
import { KeyRound, Plus, Trash2, Check, Sparkles, Shuffle, Copy, CheckCircle2 } from "lucide-react";
import { AnswerKey } from "../../types";
import { DEFAULT_ANSWER_KEY } from "../../utils/grading";

interface AnswerKeyManagerProps {
  answerKeys: AnswerKey[];
  activeKeyId: string;
  onSelectActiveKey: (keyId: string) => void;
  onSaveKey: (key: AnswerKey) => void;
  onDeleteKey: (keyId: string) => void;
}

export function AnswerKeyManager({
  answerKeys,
  activeKeyId,
  onSelectActiveKey,
  onSaveKey,
  onDeleteKey,
}: AnswerKeyManagerProps) {
  const [editingKey, setEditingKey] = useState<AnswerKey | null>(null);
  const [rawKeyInput, setRawKeyInput] = useState("");

  const activeKey = answerKeys.find((k) => k.id === activeKeyId) || answerKeys[0] || DEFAULT_ANSWER_KEY;

  const handleStartNewKey = () => {
    const newKey: AnswerKey = {
      id: "key-" + Date.now(),
      title: "NEW_ANSWER_KEY_60",
      subject: "MATHEMATICS / SCIENCE",
      grade_level: "GRADE 10",
      created_at: new Date().toISOString(),
      passing_score_percentage: 75,
      total_items: 60,
      keys: { ...DEFAULT_ANSWER_KEY.keys },
    };
    setEditingKey(newKey);
  };

  const handleOptionChange = (itemNum: number, opt: "A" | "B" | "C" | "D") => {
    if (!editingKey) return;
    setEditingKey({
      ...editingKey,
      keys: {
        ...editingKey.keys,
        [itemNum]: opt,
      },
    });
  };

  const applyPattern = (pattern: "ABCD" | "RANDOM" | "ALL_A" | "ALL_B" | "ALL_C" | "ALL_D") => {
    if (!editingKey) return;
    const newKeys: Record<number, "A" | "B" | "C" | "D"> = {};
    const opts = ["A", "B", "C", "D"] as const;

    for (let i = 1; i <= 60; i++) {
      if (pattern === "ABCD") {
        newKeys[i] = opts[(i - 1) % 4];
      } else if (pattern === "RANDOM") {
        newKeys[i] = opts[Math.floor(Math.random() * 4)];
      } else if (pattern === "ALL_A") {
        newKeys[i] = "A";
      } else if (pattern === "ALL_B") {
        newKeys[i] = "B";
      } else if (pattern === "ALL_C") {
        newKeys[i] = "C";
      } else if (pattern === "ALL_D") {
        newKeys[i] = "D";
      }
    }

    setEditingKey({
      ...editingKey,
      keys: newKeys,
    });
  };

  const handleParseRawString = () => {
    if (!editingKey || !rawKeyInput.trim()) return;
    const clean = rawKeyInput.toUpperCase().replace(/[^ABCD]/g, "");
    const newKeys = { ...editingKey.keys };
    for (let i = 0; i < clean.length && i < 60; i++) {
      newKeys[i + 1] = clean[i] as "A" | "B" | "C" | "D";
    }
    setEditingKey({
      ...editingKey,
      keys: newKeys,
    });
    setRawKeyInput("");
  };

  const handleSave = () => {
    if (!editingKey) return;
    onSaveKey(editingKey);
    onSelectActiveKey(editingKey.id);
    setEditingKey(null);
  };

  const optionLetters = ["A", "B", "C", "D"] as const;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#272C33] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-[#FF7A00] rounded-xs shadow-[0_0_6px_#FF7A00]" />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              GRADING_PROFILES // KEY_REGISTRY
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
            <span>STANDARD_ANSWER_KEYS_60</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure correct choices for automated 100% precision auto-grading.
          </p>
        </div>

        <button
          onClick={handleStartNewKey}
          className="px-4 py-2.5 bg-[#FF7A00] text-black font-black text-xs uppercase tracking-wider rounded-xs shadow-[0_0_10px_#FF7A00] flex items-center space-x-1.5 transition-transform active:scale-95 self-start sm:self-auto hover:bg-[#FF8C1A]"
        >
          <Plus className="w-4 h-4" />
          <span>CREATE_KEY</span>
        </button>
      </div>

      {/* Answer Keys List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {answerKeys.map((key) => {
          const isActive = key.id === activeKeyId;

          return (
            <div
              key={key.id}
              className={`p-4 rounded-xs border transition-all ${
                isActive
                  ? "bg-[#14171A] border-[#FF7A00] shadow-[0_0_15px_rgba(255,122,0,0.15)]"
                  : "bg-[#14171A] border-[#272C33] hover:border-slate-600"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white uppercase">
                      {key.title}
                    </span>
                    {isActive && (
                      <span className="px-1.5 py-0.2 rounded-xs text-[9px] font-black bg-[#FF7A00] text-black uppercase shadow-[0_0_6px_#FF7A00]">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 uppercase">
                    {key.subject} • PASS: {key.passing_score_percentage}% • {key.total_items} ITEMS
                  </p>
                </div>

                <div className="flex items-center space-x-1.5">
                  {!isActive && (
                    <button
                      onClick={() => onSelectActiveKey(key.id)}
                      className="px-2.5 py-1 text-xs font-bold text-[#FF7A00] border border-[#FF7A00]/50 hover:bg-[#FF7A00]/10 rounded-xs uppercase transition-colors"
                    >
                      SET_ACTIVE
                    </button>
                  )}
                  <button
                    onClick={() => setEditingKey({ ...key })}
                    className="p-1.5 text-slate-300 hover:text-white bg-[#0D0F12] border border-slate-700 hover:border-slate-500 rounded-xs transition-colors text-xs font-bold"
                    title="Edit Key"
                  >
                    EDIT
                  </button>
                  {answerKeys.length > 1 && (
                    <button
                      onClick={() => onDeleteKey(key.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 bg-[#0D0F12] border border-slate-800 hover:border-rose-800 rounded-xs transition-colors"
                      title="Delete Key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Key Editor Drawer / Modal */}
      {editingKey && (
        <div className="bg-[#14171A] rounded-xs border border-[#FF7A00]/60 p-4 sm:p-5 shadow-[0_0_25px_rgba(255,122,0,0.15)] space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#272C33]">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                EDIT_KEY // {editingKey.title}
              </h3>
              <p className="text-xs text-slate-400">Configure key values for items 1 to 60</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setEditingKey(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-[#0D0F12] border border-slate-700 rounded-xs uppercase"
              >
                CANCEL
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-1.5 bg-[#FF7A00] text-black font-black text-xs uppercase tracking-wider rounded-xs shadow-[0_0_8px_#FF7A00] hover:bg-[#FF8C1A]"
              >
                SAVE_KEY
              </button>
            </div>
          </div>

          {/* Key Metadata Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                KEY_TITLE
              </label>
              <input
                type="text"
                value={editingKey.title}
                onChange={(e) => setEditingKey({ ...editingKey, title: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs text-white focus:border-[#FF7A00] focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                SUBJECT
              </label>
              <input
                type="text"
                value={editingKey.subject}
                onChange={(e) => setEditingKey({ ...editingKey, subject: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs text-white focus:border-[#FF7A00] focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                PASSING_SCORE (%)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={editingKey.passing_score_percentage}
                onChange={(e) =>
                  setEditingKey({
                    ...editingKey,
                    passing_score_percentage: parseInt(e.target.value, 10) || 75,
                  })
                }
                className="w-full mt-1 px-2.5 py-1.5 bg-[#0D0F12] border border-slate-700 rounded-xs text-xs text-white focus:border-[#FF7A00] focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Pattern Ingestion Toolbar */}
          <div className="p-3 bg-[#0D0F12] rounded-xs border border-[#272C33] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#FF7A00] mr-1 uppercase">PRESETS:</span>
              <button
                type="button"
                onClick={() => applyPattern("ABCD")}
                className="px-2 py-1 bg-[#1C1F24] border border-slate-700 text-slate-200 rounded-xs text-[10px] font-bold uppercase hover:border-[#FF7A00]/50"
              >
                A-B-C-D_LOOP
              </button>
              <button
                type="button"
                onClick={() => applyPattern("RANDOM")}
                className="px-2 py-1 bg-[#1C1F24] border border-slate-700 text-slate-200 rounded-xs text-[10px] font-bold uppercase hover:border-[#FF7A00]/50"
              >
                RANDOM
              </button>
              <button
                type="button"
                onClick={() => applyPattern("ALL_A")}
                className="px-2 py-1 bg-[#1C1F24] border border-slate-700 text-slate-200 rounded-xs text-[10px] font-bold uppercase"
              >
                ALL_A
              </button>
              <button
                type="button"
                onClick={() => applyPattern("ALL_B")}
                className="px-2 py-1 bg-[#1C1F24] border border-slate-700 text-slate-200 rounded-xs text-[10px] font-bold uppercase"
              >
                ALL_B
              </button>
              <button
                type="button"
                onClick={() => applyPattern("ALL_C")}
                className="px-2 py-1 bg-[#1C1F24] border border-slate-700 text-slate-200 rounded-xs text-[10px] font-bold uppercase"
              >
                ALL_C
              </button>
              <button
                type="button"
                onClick={() => applyPattern("ALL_D")}
                className="px-2 py-1 bg-[#1C1F24] border border-slate-700 text-slate-200 rounded-xs text-[10px] font-bold uppercase"
              >
                ALL_D
              </button>
            </div>

            {/* Paste answer string */}
            <div className="flex items-center space-x-1.5 w-full sm:w-auto">
              <input
                type="text"
                value={rawKeyInput}
                onChange={(e) => setRawKeyInput(e.target.value)}
                placeholder="PASTE_RAW_STRING (ABCD...)"
                className="flex-1 sm:flex-none px-2 py-1 text-xs bg-[#1C1F24] border border-slate-700 rounded-xs sm:w-48 font-mono uppercase text-white focus:border-[#FF7A00] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleParseRawString}
                className="px-3 py-1 bg-[#FF7A00] text-black rounded-xs text-xs font-black uppercase shadow-[0_0_6px_#FF7A00]"
              >
                APPLY
              </button>
            </div>
          </div>

          {/* 60 Questions Answer Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {[0, 1, 2, 3].map((colIdx) => {
              const startItem = colIdx * 15 + 1;
              return (
                <div
                  key={colIdx}
                  className="bg-[#0D0F12] border border-[#272C33] p-2 space-y-1 rounded-xs"
                >
                  <div className="text-[9px] font-bold text-slate-400 pb-1 border-b border-[#272C33] flex justify-between uppercase">
                    <span>Q{startItem} - Q{startItem + 14}</span>
                    <span>KEY</span>
                  </div>

                  {Array.from({ length: 15 }, (_, i) => {
                    const itemNum = startItem + i;
                    const selectedOpt = editingKey.keys[itemNum] || "A";

                    return (
                      <div
                        key={itemNum}
                        className="flex items-center justify-between px-1.5 py-0.5 border-b border-slate-800/40"
                      >
                        <span className="font-mono text-[10px] text-slate-400">
                          {itemNum < 10 ? `0${itemNum}` : itemNum}.
                        </span>

                        <div className="flex items-center space-x-1">
                          {optionLetters.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleOptionChange(itemNum, opt)}
                              className={`w-5 h-5 rounded-xs text-[9px] font-black transition-all ${
                                selectedOpt === opt
                                  ? "bg-[#FF7A00] text-black font-black shadow-[0_0_6px_#FF7A00]"
                                  : "bg-[#1C1F24] text-slate-400 border border-slate-700 hover:border-[#FF7A00]/50"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
