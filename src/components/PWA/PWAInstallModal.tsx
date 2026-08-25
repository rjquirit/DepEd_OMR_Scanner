import React, { useState } from "react";
import { Download, CheckCircle2, Smartphone, Share, PlusSquare, Sparkles, X, Check, Laptop } from "lucide-react";
import { PWAState } from "../../utils/usePWA";

interface PWAInstallModalProps {
  pwa: PWAState;
  isOpen: boolean;
  onClose: () => void;
}

export function PWAInstallModal({ pwa, isOpen, onClose }: PWAInstallModalProps) {
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (pwa.installApp) {
      const accepted = await pwa.installApp();
      if (accepted) {
        setInstallSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
      <div className="bg-[#14171A] border border-[#FF7A00]/50 rounded-xs max-w-md w-full p-5 sm:p-6 space-y-5 shadow-[0_0_25px_rgba(255,122,0,0.25)] relative text-slate-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xs bg-[#1C1F24] border border-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xs bg-[#1C1F24] border border-[#FF7A00]/50 text-[#FF7A00] flex items-center justify-center shadow-[0_0_12px_rgba(255,122,0,0.3)]">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#FF7A00] uppercase font-bold tracking-wider">
              PROGRESSIVE_WEB_APP // PWA_NODE
            </span>
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
              INSTALL OMR SCANNER
            </h3>
          </div>
        </div>

        {/* PWA Benefits */}
        <div className="bg-[#0D0F12] border border-slate-800 p-3.5 space-y-2 rounded-xs text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A00] shrink-0" />
            <span>Fast sub-25ms native camera viewfinder</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A00] shrink-0" />
            <span>Works 100% offline with Computer Vision</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A00] shrink-0" />
            <span>Zero-latency desktop & mobile app launcher</span>
          </div>
        </div>

        {/* Dynamic Instructions */}
        {pwa.isInstalled ? (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/50 rounded-xs text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>APP_INSTALLED: Application is running in standalone mode.</span>
          </div>
        ) : pwa.isIOS ? (
          <div className="space-y-2 text-xs text-slate-300 bg-[#1C1F24] p-3.5 border border-slate-700 rounded-xs">
            <p className="font-bold text-[#FF7A00] uppercase">How to install on iOS Safari:</p>
            <ol className="list-decimal pl-4 space-y-1 text-slate-400">
              <li>
                Tap the <strong className="text-white">Share</strong> button <Share className="w-3 h-3 inline text-[#FF7A00]" /> at the bottom of Safari.
              </li>
              <li>
                Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong> <PlusSquare className="w-3 h-3 inline text-[#FF7A00]" />.
              </li>
              <li>
                Tap <strong className="text-white">"Add"</strong> in the top-right corner.
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Click below to add OMR Scanner to your home screen or desktop application menu.
            </p>

            <button
              onClick={handleInstallClick}
              disabled={installSuccess}
              className="w-full py-2.5 bg-[#FF7A00] text-black font-extrabold text-xs uppercase tracking-widest rounded-xs shadow-[0_0_15px_#FF7A00] flex items-center justify-center space-x-2 active:scale-98 transition-all hover:bg-[#FF8C1A]"
            >
              {installSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>INSTALLING_APP...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>INSTALL_OMR_APP_NOW</span>
                </>
              )}
            </button>
          </div>
        )}

        <div className="pt-1 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 uppercase font-mono"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
