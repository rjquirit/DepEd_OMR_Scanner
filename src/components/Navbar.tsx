import { Scan, KeyRound, Users, Printer, FileQuestion, Download, CheckCircle2, Smartphone } from "lucide-react";
import { PWAState } from "../utils/usePWA";

interface NavbarProps {
  activeTab: "scanner" | "keys" | "roster" | "generator" | "guide";
  setActiveTab: (tab: "scanner" | "keys" | "roster" | "generator" | "guide") => void;
  rosterCount: number;
  hasActiveKey: boolean;
  pwa?: PWAState;
  onOpenPWAInstall?: () => void;
}

export function Navbar({
  activeTab,
  setActiveTab,
  rosterCount,
  hasActiveKey,
  pwa,
  onOpenPWAInstall,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#14171A] border-b border-[#272C33] text-slate-200 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Title */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none"
            onClick={() => setActiveTab("scanner")}
          >
            <div className="w-3.5 h-3.5 bg-[#FF7A00] rounded-xs shadow-[0_0_10px_#FF7A00]" />
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-widest text-white uppercase font-mono">
                OMR_SCANNER
              </span>
              <span className="text-[9px] uppercase font-bold bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/40 px-1.5 sm:px-2 py-0.5 rounded-xs">
                TANGERINE
              </span>
            </div>
          </div>

          {/* Nav Tabs (Desktop & Tablet) */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 text-[11px] font-mono">
            <button
              id="nav-scanner-btn"
              onClick={() => setActiveTab("scanner")}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xs transition-all uppercase tracking-wider font-semibold min-h-[36px] ${
                activeTab === "scanner"
                  ? "bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/70 shadow-[0_0_10px_rgba(255,122,0,0.25)]"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent"
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SCAN_NODE</span>
              <span className="sm:hidden">SCAN</span>
            </button>

            <button
              id="nav-roster-btn"
              onClick={() => setActiveTab("roster")}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xs transition-all uppercase tracking-wider font-semibold min-h-[36px] ${
                activeTab === "roster"
                  ? "bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/70 shadow-[0_0_10px_rgba(255,122,0,0.25)]"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ROSTER</span>
              {rosterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[9px] rounded-xs bg-[#FF7A00] text-black font-extrabold shadow-[0_0_6px_#FF7A00]">
                  {rosterCount}
                </span>
              )}
            </button>

            <button
              id="nav-keys-btn"
              onClick={() => setActiveTab("keys")}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xs transition-all uppercase tracking-wider font-semibold min-h-[36px] ${
                activeTab === "keys"
                  ? "bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/70 shadow-[0_0_10px_rgba(255,122,0,0.25)]"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden md:inline">ANSWER_KEYS</span>
              <span className="md:hidden">KEYS</span>
              {hasActiveKey && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] shadow-[0_0_6px_#FF7A00]" />
              )}
            </button>

            <button
              id="nav-generator-btn"
              onClick={() => setActiveTab("generator")}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xs transition-all uppercase tracking-wider font-semibold min-h-[36px] ${
                activeTab === "generator"
                  ? "bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/70 shadow-[0_0_10px_rgba(255,122,0,0.25)]"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">SHEET_GEN</span>
              <span className="lg:hidden">PRINT</span>
            </button>

            <button
              id="nav-guide-btn"
              onClick={() => setActiveTab("guide")}
              className={`p-2 rounded-xs transition-colors border min-h-[36px] min-w-[36px] flex items-center justify-center ${
                activeTab === "guide"
                  ? "border-[#FF7A00]/70 text-[#FF7A00] bg-[#FF7A00]/15 shadow-[0_0_8px_rgba(255,122,0,0.2)]"
                  : "border-transparent text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="OMR Technical Standards & Spec"
            >
              <FileQuestion className="w-4 h-4" />
            </button>

            {/* PWA Install Action Button */}
            {onOpenPWAInstall && (
              <button
                id="nav-pwa-install-btn"
                onClick={onOpenPWAInstall}
                className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xs bg-[#FF7A00] text-black font-extrabold text-[11px] uppercase tracking-wider shadow-[0_0_10px_#FF7A00] hover:bg-[#FF8C1A] active:scale-95 transition-all min-h-[36px]"
                title="Install OMR Scanner Progressive Web App"
              >
                {pwa?.isInstalled ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">PWA_INSTALLED</span>
                    <span className="md:hidden">PWA</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 animate-bounce" />
                    <span className="hidden md:inline">INSTALL_PWA</span>
                    <span className="md:hidden">INSTALL</span>
                  </>
                )}
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

