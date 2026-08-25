import { FileText, CheckCircle2, XCircle, AlertTriangle, Scan, ShieldCheck, HelpCircle, Terminal, Cpu, Zap } from "lucide-react";

export function OMRGuideModal() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto font-mono">
      <div className="border-b border-[#272C33] pb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-[#FF7A00] rounded-xs shadow-[0_0_6px_#FF7A00]" />
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            COMPUTER_VISION_PIPELINE // OMR_CORE_ENGINE
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
          <span>OMR_COMPUTER_VISION_SPECIFICATION</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Pure deterministic Computer Vision (CV) image processing pipeline for high-speed, sub-25ms optical mark recognition.
        </p>
      </div>

      {/* CV Engine Highlight Banner */}
      <div className="bg-[#14171A] p-4 rounded-xs border border-[#FF7A00]/40 shadow-[0_0_15px_rgba(255,122,0,0.1)] flex items-start gap-3">
        <Cpu className="w-5 h-5 text-[#FF7A00] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>DETERMINISTIC_CV_PIPELINE</span>
            <span className="px-1.5 py-0.2 bg-[#FF7A00]/15 text-[#FF7A00] text-[9px] font-bold border border-[#FF7A00]/40">
              SUB-25ms • 0% AI HALLUCINATION
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            The scanner uses a native Computer Vision pipeline: Grayscale Luminance Transformation → Otsu Global Optimal Binarization → Fiducial Corner Alignment → Circular Kernel Pixel Density Integration for 120 LRN bubbles and 240 Question Item bubbles.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rule 1: Student LRN */}
        <div className="bg-[#14171A] p-4 rounded-xs border border-[#272C33] space-y-3">
          <div className="flex items-center space-x-2 text-[#FF7A00] font-bold text-xs uppercase tracking-wider">
            <span className="w-5 h-5 bg-[#0D0F12] border border-[#FF7A00]/50 text-[#FF7A00] flex items-center justify-center text-[10px] font-black">
              01
            </span>
            <span>STUDENT_LRN (12-DIGIT GRID)</span>
          </div>
          <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
            <li>
              <strong className="text-white">12 Columns Grid:</strong> Located top-right, with 12 vertical columns representing digits 0 to 9.
            </li>
            <li>
              <strong className="text-white">Left-to-Right Order:</strong> Scanned strictly from Column 1 (leftmost) to Column 12 (rightmost).
            </li>
            <li>
              <strong className="text-white">Density Threshold:</strong> The shaded bubble in each column with highest dark pixel density (&gt;30%) resolves the digit.
            </li>
            <li>
              <strong className="text-white">Ambiguity Handling:</strong> If a column has no bubble filled or dual marks, outputted as <code className="px-1 py-0.2 bg-[#0D0F12] text-amber-400 border border-amber-500/40">"?"</code>.
            </li>
          </ul>
        </div>

        {/* Rule 2: Items 1 to 60 */}
        <div className="bg-[#14171A] p-4 rounded-xs border border-[#272C33] space-y-3">
          <div className="flex items-center space-x-2 text-[#FF7A00] font-bold text-xs uppercase tracking-wider">
            <span className="w-5 h-5 bg-[#0D0F12] border border-[#FF7A00]/50 text-[#FF7A00] flex items-center justify-center text-[10px] font-black">
              02
            </span>
            <span>ANSWER ITEMS (1 TO 60)</span>
          </div>
          <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
            <li>
              <strong className="text-white">4 Columns of 15 Items:</strong> Sequential scanning across items 1-15, 16-30, 31-45, 46-60.
            </li>
            <li>
              <strong className="text-white">Options A, B, C, D:</strong> Returns strictly <code className="px-1 py-0.2 bg-[#0D0F12] text-[#FF7A00] border border-[#FF7A00]/40 font-bold">"A"</code>, <code className="px-1 py-0.2 bg-[#0D0F12] text-[#FF7A00] border border-[#FF7A00]/40 font-bold">"B"</code>, <code className="px-1 py-0.2 bg-[#0D0F12] text-[#FF7A00] border border-[#FF7A00]/40 font-bold">"C"</code>, or <code className="px-1 py-0.2 bg-[#0D0F12] text-[#FF7A00] border border-[#FF7A00]/40 font-bold">"D"</code> based on circular kernel integral.
            </li>
            <li>
              <strong className="text-white">Multiple Marks:</strong> If multiple bubbles exceed the density threshold within 85% of each other, flags <code className="px-1 py-0.2 bg-amber-950/40 text-amber-300 border border-amber-500/40">"MULTIPLE"</code>.
            </li>
            <li>
              <strong className="text-white">Omitted / Blank:</strong> If no bubble exceeds the threshold (&lt;16%), returns <code className="px-1 py-0.2 bg-[#0D0F12] text-slate-500">null</code>.
            </li>
          </ul>
        </div>
      </div>

      {/* Output Schema Reference Card */}
      <div className="bg-[#14171A] p-4 rounded-xs border border-[#272C33] space-y-2">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
          <span>JSON_TELEMETRY_SCHEMA</span>
          <span className="text-[10px] text-[#FF7A00] font-bold">CV_ENGINE_OUTPUT</span>
        </h3>
        <pre className="p-3 bg-[#0D0F12] text-[#FF7A00] font-mono text-xs rounded-xs overflow-x-auto border border-[#272C33]">
{`{
  "student_lrn": "112298760012",
  "metadata": {
    "name": "JUAN DELA CRUZ",
    "section": "10 - RIZAL",
    "school_id": "301942",
    "grade_level": "GRADE 10",
    "subject": "SCIENCE"
  },
  "answers": [
    { "item_number": 1, "selected_option": "A", "confidence": 98 },
    { "item_number": 2, "selected_option": "A", "confidence": 95 },
    { "item_number": 3, "selected_option": "A", "confidence": 99 },
    { "item_number": 4, "selected_option": "B", "confidence": 94 },
    { "item_number": 5, "selected_option": "C", "confidence": 97 },
    { "item_number": 6, "selected_option": "D", "confidence": 96 }
    ... (all 60 items)
  ],
  "engine": "OPENCV_C++_SHARP_CV_V4",
  "processing_time_ms": 14.8
}`}
        </pre>
      </div>

      {/* Best Scanning Practices */}
      <div className="bg-[#14171A] p-4 rounded-xs border border-[#272C33] space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center space-x-2 uppercase tracking-wider">
          <Scan className="w-4 h-4 text-[#FF7A00]" />
          <span>ACCURACY_OPTIMIZATION_DIRECTIVES</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="p-3 bg-[#0D0F12] border border-[#272C33] rounded-xs">
            <span className="font-bold text-[#FF7A00] block mb-1 uppercase">1. UNIFORM_LIGHTING</span>
            Prevent harsh shadows over the bubble grid. Use built-in contrast booster for faint pencil marks.
          </div>
          <div className="p-3 bg-[#0D0F12] border border-[#272C33] rounded-xs">
            <span className="font-bold text-[#FF7A00] block mb-1 uppercase">2. 4-CORNER_ALIGNMENT</span>
            Keep the paper flat and aligned within the orange reticles in the live camera viewfinder.
          </div>
          <div className="p-3 bg-[#0D0F12] border border-[#272C33] rounded-xs">
            <span className="font-bold text-[#FF7A00] block mb-1 uppercase">3. DENSE_SHADING</span>
            Use standard 2B pencil or black pen to shade bubbles without stray lines across neighboring items.
          </div>
        </div>
      </div>
    </div>
  );
}
