import { useState, useEffect } from "react";
import { Camera, Upload, AlertCircle, Loader2, Download, Smartphone, Sparkles } from "lucide-react";
import { Navbar } from "./components/Navbar";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { CameraViewfinder } from "./components/Scanner/CameraViewfinder";
import { FileUploader } from "./components/Scanner/FileUploader";
import { ScanResultInspector } from "./components/Results/ScanResultInspector";
import { AnswerKeyManager } from "./components/AnswerKeys/AnswerKeyManager";
import { ClassGradebook } from "./components/Roster/ClassGradebook";
import { PrintableOMRGenerator } from "./components/PrintableSheet/PrintableOMRGenerator";
import { OMRGuideModal } from "./components/Help/OMRGuideModal";
import { PWAInstallModal } from "./components/PWA/PWAInstallModal";
import { OMRDiagnosticWorkbench } from "./components/Diagnostics/OMRDiagnosticWorkbench";
import { AnswerKey, OMRScanResult, ScannedRecord } from "./types";
import { DEFAULT_ANSWER_KEY } from "./utils/grading";
import { processOMRWithCV } from "./utils/omrCvEngine";
import { usePWA } from "./utils/usePWA";

export default function App() {
  const [activeTab, setActiveTab] = useState<"scanner" | "keys" | "roster" | "generator" | "guide" | "diagnostics">("scanner");
  const [scanMode, setScanMode] = useState<"camera" | "upload">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isPWAOpen, setIsPWAOpen] = useState(false);

  // Progressive Web App State Hook
  const pwa = usePWA();

  // Active Scanned Result & Image
  const [currentScanResult, setCurrentScanResult] = useState<OMRScanResult | null>(null);
  const [currentImagePreview, setCurrentImagePreview] = useState<string | undefined>(undefined);

  // Persistent Answer Keys
  const [answerKeys, setAnswerKeys] = useState<AnswerKey[]>(() => {
    try {
      const saved = localStorage.getItem("omr_answer_keys");
      return saved ? JSON.parse(saved) : [DEFAULT_ANSWER_KEY];
    } catch {
      return [DEFAULT_ANSWER_KEY];
    }
  });
  const [activeKeyId, setActiveKeyId] = useState<string>(DEFAULT_ANSWER_KEY.id);

  // Persistent Class Roster Records
  const [rosterRecords, setRosterRecords] = useState<ScannedRecord[]>(() => {
    try {
      const saved = localStorage.getItem("omr_roster_records");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("omr_answer_keys", JSON.stringify(answerKeys));
    } catch (e) {
      console.warn("Storage error:", e);
    }
  }, [answerKeys]);

  useEffect(() => {
    try {
      localStorage.setItem("omr_roster_records", JSON.stringify(rosterRecords));
    } catch (e) {
      console.warn("Storage error:", e);
    }
  }, [rosterRecords]);

  const activeKey = answerKeys.find((k) => k.id === activeKeyId) || answerKeys[0] || DEFAULT_ANSWER_KEY;

  // Process image with deterministic Computer Vision OMR pipeline (C++ Native Sharp on server / In-browser CV fallback)
  const handleProcessImage = async (imageBase64: string) => {
    setIsProcessing(true);
    setScanError(null);
    setCurrentImagePreview(imageBase64);

    try {
      // 1. Attempt High-Speed Server Native Computer Vision Engine
      const response = await fetch("/api/scan-omr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64,
        }),
      });

      if (response.ok) {
        const result: OMRScanResult = await response.json();
        setCurrentScanResult(result);
        setActiveTab("scanner");
        return;
      }

      throw new Error(`Server CV error status: ${response.status}`);
    } catch (serverErr) {
      console.warn("Server CV unavailable, running client-side CV engine:", serverErr);
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageBase64;
        });

        const clientCvResult = await processOMRWithCV(img);
        setCurrentScanResult(clientCvResult);
        setActiveTab("scanner");
      } catch (clientErr: any) {
        console.error("OMR Computer Vision recognition failed:", clientErr);
        setScanError(clientErr.message || "Failed to analyze answer sheet via Computer Vision.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Add a student scan to class roster
  const handleSaveToRoster = (record: ScannedRecord) => {
    setRosterRecords((prev) => [record, ...prev]);
  };

  // Save scanned sheet as a Master Answer Key
  const handleSaveAsAnswerKey = (newKey: AnswerKey, makeActive = true) => {
    setAnswerKeys((prev) => {
      const idx = prev.findIndex((k) => k.id === newKey.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = newKey;
        return updated;
      }
      return [newKey, ...prev];
    });
    if (makeActive) {
      setActiveKeyId(newKey.id);
    }
  };

  // Select a record from roster to inspect
  const handleSelectRecordFromRoster = (record: ScannedRecord) => {
    setCurrentScanResult(record.scan_result);
    setCurrentImagePreview(record.image_preview);
    setActiveTab("scanner");
  };

  const handleNewScan = () => {
    setCurrentScanResult(null);
    setCurrentImagePreview(undefined);
    setScanError(null);
  };

  return (
    <div className="min-h-screen bg-[#0D0F12] text-slate-200 flex flex-col font-mono relative overflow-x-hidden selection:bg-[#FF7A00] selection:text-black">
      {/* Background Dot-Matrix Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 z-0"
        style={{
          backgroundImage: "radial-gradient(#334155 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        rosterCount={rosterRecords.length}
        hasActiveKey={Boolean(activeKey)}
        pwa={pwa}
        onOpenPWAInstall={() => setIsPWAOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 pb-24 sm:pb-8 relative z-10">
        {/* VIEW 1: Scanner & Results */}
        {activeTab === "scanner" && (
          <div className="space-y-6">
            {!currentScanResult ? (
              <div className="space-y-6">
                {/* Header & Mode Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#272C33] pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-[#FF7A00] rounded-xs shadow-[0_0_6px_#FF7A00]" />
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                        OPTICAL_MARK_RECOGNITION // FEED_CONTROLLER
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono uppercase">
                      60-ITEM OMR SHEET SCANNER
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Extracts 12-digit student LRN, sequential items 1-60, and printed header metadata.
                    </p>
                  </div>

                  {/* Mode Switcher & PWA Quick Install Button */}
                  <div className="flex items-center flex-wrap gap-2">
                    {!pwa.isInstalled && (
                      <button
                        id="scanner-install-pwa-btn"
                        onClick={() => setIsPWAOpen(true)}
                        className="flex items-center space-x-2 px-3 py-1.5 text-xs font-black font-mono uppercase tracking-wider bg-[#FF7A00]/15 text-[#FF7A00] hover:bg-[#FF7A00] hover:text-black border border-[#FF7A00]/60 rounded-xs shadow-[0_0_10px_rgba(255,122,0,0.2)] transition-all"
                        title="Install app for offline scanning and faster camera access"
                      >
                        <Download className="w-3.5 h-3.5 animate-bounce" />
                        <span>INSTALL_APP</span>
                      </button>
                    )}

                    <div className="flex items-center space-x-1 bg-[#14171A] p-1 border border-[#272C33] self-start sm:self-auto rounded-xs">
                      <button
                        id="mode-upload-btn"
                        onClick={() => setScanMode("upload")}
                        className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-black font-mono uppercase tracking-wider transition-all rounded-xs ${
                          scanMode === "upload"
                            ? "bg-[#FF7A00] text-black shadow-[0_0_8px_rgba(255,122,0,0.4)]"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>FILE_UPLOAD</span>
                      </button>

                      <button
                        id="mode-camera-btn"
                        onClick={() => setScanMode("camera")}
                        className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-black font-mono uppercase tracking-wider transition-all rounded-xs ${
                          scanMode === "camera"
                            ? "bg-[#FF7A00] text-black shadow-[0_0_8px_rgba(255,122,0,0.4)]"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>LIVE_CAM</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Processing Overlay Banner */}
                {isProcessing && (
                  <div className="bg-[#14171A] border border-[#FF7A00]/60 text-slate-200 p-5 rounded-xs flex items-center space-x-4 shadow-[0_0_15px_rgba(255,122,0,0.15)] relative overflow-hidden">
                    <div className="w-1 absolute inset-y-0 left-0 bg-[#FF7A00]" />
                    <Loader2 className="w-6 h-6 animate-spin text-[#FF7A00] shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#FF7A00] tracking-wider uppercase font-mono">
                          ANALYZING_OMR_SHEET_STREAM
                        </span>
                        <span className="text-[10px] bg-[#FF7A00]/15 text-[#FF7A00] px-1.5 py-0.2 border border-[#FF7A00]/30 font-bold">
                          PRECISION: 100%
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        Resolving 12-column LRN matrix, analyzing 60-bubble mark densities, and reading header strings.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {scanError && (
                  <div className="p-4 bg-rose-950/30 border border-rose-800/80 rounded-xs flex items-start space-x-3 text-rose-300 text-xs font-mono">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold uppercase tracking-wider text-rose-400">EXTRACTION_FAULT</p>
                      <p>{scanError}</p>
                    </div>
                  </div>
                )}

                {/* Main Scanning Interfaces */}
                {scanMode === "camera" ? (
                  <CameraViewfinder
                    onCaptureImage={handleProcessImage}
                    isProcessing={isProcessing}
                  />
                ) : (
                  <FileUploader
                    onSelectImage={handleProcessImage}
                    isProcessing={isProcessing}
                  />
                )}
              </div>
            ) : (
              /* Scan Result Detailed Inspector */
              <ScanResultInspector
                scanResult={currentScanResult}
                imageSrc={currentImagePreview}
                activeAnswerKey={activeKey}
                onSaveToRoster={handleSaveToRoster}
                onSaveAsAnswerKey={handleSaveAsAnswerKey}
                onNewScan={handleNewScan}
              />
            )}
          </div>
        )}

        {/* VIEW 2: Answer Keys Manager */}
        {activeTab === "keys" && (
          <AnswerKeyManager
            answerKeys={answerKeys}
            activeKeyId={activeKeyId}
            onSelectActiveKey={setActiveKeyId}
            onSaveKey={(newKey) => {
              setAnswerKeys((prev) => {
                const idx = prev.findIndex((k) => k.id === newKey.id);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = newKey;
                  return updated;
                }
                return [...prev, newKey];
              });
            }}
            onDeleteKey={(keyId) => {
              if (answerKeys.length <= 1) return;
              setAnswerKeys((prev) => prev.filter((k) => k.id !== keyId));
              if (activeKeyId === keyId) {
                setActiveKeyId(answerKeys[0].id);
              }
            }}
          />
        )}

        {/* VIEW 3: Class Gradebook / Roster */}
        {activeTab === "roster" && (
          <ClassGradebook
            records={rosterRecords}
            onSelectRecord={handleSelectRecordFromRoster}
            onDeleteRecord={(id) => setRosterRecords((prev) => prev.filter((r) => r.id !== id))}
            onClearAllRecords={() => setRosterRecords([])}
          />
        )}

        {/* VIEW 4: Printable Sheet Generator */}
        {activeTab === "generator" && (
          <PrintableOMRGenerator
            onScanGeneratedSheet={(dataUrl) => {
              handleProcessImage(dataUrl);
            }}
          />
        )}

        {/* VIEW 5: OMR Technical Diagnostics & CV Workbench */}
        {activeTab === "diagnostics" && <OMRDiagnosticWorkbench />}

        {/* VIEW 6: OMR Guidelines & Standards Guide */}
        {activeTab === "guide" && <OMRGuideModal />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        rosterCount={rosterRecords.length}
        pwa={pwa}
        onOpenPWAInstall={() => setIsPWAOpen(true)}
      />

      {/* Geometric Balance HUD Footer */}
      <footer className="hidden sm:flex h-10 border-t border-[#272C33] bg-[#0D0F12] items-center px-4 sm:px-8 gap-6 text-[10px] text-slate-400 font-mono select-none z-20">
        <div className="flex items-center gap-4">
          <div>
            ENGINE: <span className="text-[#FF7A00] font-bold">OPENCV_OMR_CV4</span>
          </div>
          <div className="text-slate-600">|</div>
          <div>STATUS: <span className="text-emerald-400 font-bold">READY</span></div>
          <div className="text-slate-600">|</div>
          <button
            onClick={() => setIsPWAOpen(true)}
            className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            title="Click to view PWA installation status"
          >
            <span>PWA:</span>
            <span className="text-[#FF7A00] font-bold underline decoration-dotted">
              {pwa.isInstalled ? "INSTALLED" : "READY_TO_INSTALL"}
            </span>
          </button>
        </div>

        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden max-w-md hidden md:block">
          <div className="w-1/3 h-full bg-[#FF7A00] shadow-[0_0_6px_#FF7A00]"></div>
        </div>

        <div className="ml-auto text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] animate-pulse"></span>
          <span>TANGERINE_THEME: ACTIVE</span>
        </div>
      </footer>

      {/* PWA Install Modal */}
      <PWAInstallModal
        pwa={pwa}
        isOpen={isPWAOpen}
        onClose={() => setIsPWAOpen(false)}
      />
    </div>
  );
}
