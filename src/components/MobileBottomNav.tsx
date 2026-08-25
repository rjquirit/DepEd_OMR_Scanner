import React from "react";
import { Scan, Users, KeyRound, Printer, FileQuestion, Download, Cpu } from "lucide-react";
import { PWAState } from "../utils/usePWA";

interface MobileBottomNavProps {
  activeTab: "scanner" | "keys" | "roster" | "generator" | "guide" | "diagnostics";
  setActiveTab: (tab: "scanner" | "keys" | "roster" | "generator" | "guide" | "diagnostics") => void;
  rosterCount: number;
  pwa?: PWAState;
  onOpenPWAInstall?: () => void;
}

interface NavItem {
  id: "scanner" | "keys" | "roster" | "generator" | "guide" | "diagnostics";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function MobileBottomNav({ activeTab, setActiveTab, rosterCount, pwa, onOpenPWAInstall }: MobileBottomNavProps) {
  const navItems: NavItem[] = [
    { id: "scanner", label: "SCAN", icon: Scan },
    { id: "roster", label: "ROSTER", icon: Users, badge: rosterCount },
    { id: "keys", label: "KEYS", icon: KeyRound },
    { id: "diagnostics", label: "DIAG", icon: Cpu },
    { id: "generator", label: "SHEET", icon: Printer },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#14171A]/95 backdrop-blur-md border-t border-[#272C33] px-2 py-1 flex items-center justify-around font-mono safe-area-pb">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            id={`mobile-nav-${item.id}-btn`}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xs min-w-[50px] min-h-[44px] relative transition-colors ${
              isActive
                ? "text-[#FF7A00]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="relative">
              <Icon className="w-4.5 h-4.5" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-[#FF7A00] text-black text-[9px] font-black px-1 rounded-full min-w-[14px] text-center shadow-[0_0_6px_#FF7A00]">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[9px] font-bold tracking-wider mt-0.5 uppercase">
              {item.label}
            </span>
            {isActive && (
              <span className="w-4 h-0.5 bg-[#FF7A00] rounded-full shadow-[0_0_6px_#FF7A00] mt-0.5" />
            )}
          </button>
        );
      })}

      {/* PWA Install Mobile Quick Button */}
      {onOpenPWAInstall && !pwa?.isInstalled && (
        <button
          id="mobile-nav-pwa-btn"
          onClick={onOpenPWAInstall}
          className="flex flex-col items-center justify-center py-1 px-1.5 rounded-xs min-w-[50px] min-h-[44px] text-[#FF7A00] hover:text-[#FF8C1A] transition-colors"
          title="Install App"
        >
          <div className="w-5 h-5 rounded-full bg-[#FF7A00]/20 border border-[#FF7A00] flex items-center justify-center shadow-[0_0_8px_rgba(255,122,0,0.3)]">
            <Download className="w-3 h-3 text-[#FF7A00] animate-pulse" />
          </div>
          <span className="text-[9px] font-bold tracking-wider mt-0.5 uppercase text-[#FF7A00]">
            INSTALL
          </span>
        </button>
      )}
    </div>
  );
}
