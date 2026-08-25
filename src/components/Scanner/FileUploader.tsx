import React, { useState, useRef } from "react";
import { Upload, RotateCw, Sparkles, FileText, ArrowRight, Layers } from "lucide-react";
import { getSampleSheets, generateOMRSheetCanvas } from "../../utils/omrCanvasGenerator";

interface FileUploaderProps {
  onSelectImage: (base64Image: string) => void;
  isProcessing: boolean;
}

export function FileUploader({ onSelectImage, isProcessing }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [contrastBoost, setContrastBoost] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleSheets = getSampleSheets();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (PNG, JPEG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewUrl(result);
      setRotation(0);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleConfirmAndScan = () => {
    if (!previewUrl) return;

    if (rotation === 0 && !contrastBoost) {
      onSelectImage(previewUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const is90or270 = rotation === 90 || rotation === 270;
      canvas.width = is90or270 ? img.height : img.width;
      canvas.height = is90or270 ? img.width : img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        onSelectImage(previewUrl);
        return;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      if (contrastBoost) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        const contrast = 1.25;
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        for (let i = 0; i < d.length; i += 4) {
          d[i] = factor * (d[i] - 128) + 128;
          d[i + 1] = factor * (d[i + 1] - 128) + 128;
          d[i + 2] = factor * (d[i + 2] - 128) + 128;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      const transformedDataUrl = canvas.toDataURL("image/jpeg", 0.95);
      onSelectImage(transformedDataUrl);
    };
    img.src = previewUrl;
  };

  const handleLoadOfficialImage = async (imagePath: string) => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
        setRotation(0);
        onSelectImage(result);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to load sample image:", err);
    }
  };

  const handleSelectSample = (sampleOptions: any) => {
    const canvas = generateOMRSheetCanvas(sampleOptions);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setPreviewUrl(dataUrl);
    setRotation(0);
    onSelectImage(dataUrl);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Drag and Drop Zone - 3:4 Aspect Ratio Frame */}
      <div className="w-full max-w-[480px] mx-auto">
        <div
          id="file-drop-zone"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !previewUrl && fileInputRef.current?.click()}
          className={`relative w-full aspect-[3/4] max-h-[580px] border-2 border-dashed rounded-xs p-6 text-center transition-all flex flex-col items-center justify-center overflow-hidden ${
            dragActive
              ? "border-[#FF7A00] bg-[#FF7A00]/15 shadow-[0_0_25px_rgba(255,122,0,0.25)]"
              : "border-[#272C33] bg-[#14171A] hover:border-slate-600"
          } ${!previewUrl ? "cursor-pointer" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* 3:4 Aspect Ratio Badge */}
          <div className="absolute top-3 right-3 text-[10px] bg-black/75 px-2 py-0.5 border border-[#FF7A00]/40 text-[#FF7A00] font-bold uppercase tracking-wider backdrop-blur-sm z-10">
            3:4 PORTRAIT
          </div>

          {/* Corner Reticle Accents */}
          <div className="absolute inset-2 pointer-events-none">
            <div className="border-2 border-[#FF7A00]/60 w-5 h-5 absolute top-0 left-0 border-r-0 border-b-0" />
            <div className="border-2 border-[#FF7A00]/60 w-5 h-5 absolute top-0 right-0 border-l-0 border-b-0" />
            <div className="border-2 border-[#FF7A00]/60 w-5 h-5 absolute bottom-0 left-0 border-r-0 border-t-0" />
            <div className="border-2 border-[#FF7A00]/60 w-5 h-5 absolute bottom-0 right-0 border-l-0 border-t-0" />
          </div>

          {!previewUrl ? (
            <div className="flex flex-col items-center justify-center space-y-3 p-4 z-10">
              <div className="w-16 h-16 rounded-xs bg-[#0D0F12] border border-[#FF7A00]/40 text-[#FF7A00] flex items-center justify-center shadow-[0_0_12px_rgba(255,122,0,0.2)]">
                <Upload className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  UPLOAD_SCANNED_SHEET // DROP_IMAGE
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                  Aspect Ratio: 3:4 Portrait (Standard 60-Item & 12-Digit LRN sheets)
                </p>
              </div>
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-[#0D0F12] border border-slate-700 hover:border-[#FF7A00]/60 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xs transition-colors shadow-sm"
              >
                BROWSE_LOCAL_FS
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <img
                src={previewUrl}
                alt="OMR Sheet Preview"
                style={{ transform: `rotate(${rotation}deg)` }}
                className="max-h-full max-w-full object-contain rounded transition-transform duration-200"
              />
            </div>
          )}
        </div>

        {/* Toolbar when image is loaded */}
        {previewUrl && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 p-3 bg-[#14171A] border border-[#272C33] rounded-xs">
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              <button
                type="button"
                onClick={handleRotate}
                className="px-3 py-2 bg-[#0D0F12] hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 rounded-xs flex items-center space-x-1.5 transition-colors uppercase min-h-[38px]"
                title="Rotate 90 degrees"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>ROTATE_{rotation}°</span>
              </button>

              <button
                type="button"
                onClick={() => setContrastBoost(!contrastBoost)}
                className={`px-3 py-2 text-xs font-bold rounded-xs flex items-center space-x-1.5 transition-colors uppercase min-h-[38px] ${
                  contrastBoost
                    ? "bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/60 shadow-[0_0_8px_rgba(255,122,0,0.2)]"
                    : "bg-[#0D0F12] text-slate-400 border border-slate-700"
                }`}
                title="Boost pencil mark contrast"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>CONTRAST_BOOST</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(null);
                  setRotation(0);
                }}
                className="text-xs text-rose-400 hover:underline px-2 py-1 uppercase min-h-[38px] flex items-center"
              >
                CLEAR_FILE
              </button>
            </div>

            <button
              type="button"
              id="process-uploaded-sheet-btn"
              disabled={isProcessing}
              onClick={handleConfirmAndScan}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#FF7A00] text-black text-xs font-black uppercase tracking-widest rounded-xs shadow-[0_0_12px_#FF7A00] flex items-center justify-center space-x-2 active:scale-95 transition-all hover:bg-[#FF8C1A] disabled:opacity-50 min-h-[40px]"
            >
              <span>{isProcessing ? "ANALYZING_STREAM..." : "RUN_EXTRACTION"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Preset Realistic Sample Sheets for instant 1-Click Testing */}
      <div className="bg-[#14171A] rounded-xs p-4 sm:p-5 border border-[#272C33] space-y-4">
        <div className="flex items-center justify-between border-b border-[#272C33] pb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#FF7A00]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              OFFICIAL_&_SYNTHETIC_TEST_PRESETS
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 uppercase">1_CLICK_EXEC</span>
        </div>

        {/* 1. Official Analyzed Test Sheets (Blank & Shaded 60 Items) */}
        <div>
          <p className="text-[11px] font-bold text-[#FF7A00] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>OFFICIAL_CALIBRATED_SHEETS // 60_ITEMS</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              id="preset-sample-answered-btn"
              onClick={() => handleLoadOfficialImage("/samples/sample_answered_60.png")}
              className="p-3.5 rounded-xs border border-[#FF7A00]/40 bg-[#FF7A00]/5 hover:bg-[#FF7A00]/10 hover:border-[#FF7A00] transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white group-hover:text-[#FF7A00] uppercase tracking-wide">
                    Sample Answered Sheet (60 Items)
                  </p>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#FF7A00] text-black font-black uppercase">
                    100% SHADED
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Official analyzed sheet with LRN 112298760012 and 60 answered items.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-[#FF7A00] uppercase">
                <span>LOAD_&_EVALUATE</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div
              id="preset-blank-sheet-btn"
              onClick={() => handleLoadOfficialImage("/samples/blank_bubble_sheet_60.png")}
              className="p-3.5 rounded-xs border border-slate-700 bg-[#1C1F24] hover:border-[#FF7A00]/60 hover:bg-[#FF7A00]/5 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white group-hover:text-[#FF7A00] uppercase tracking-wide">
                    Blank Bubble Sheet (60 Items)
                  </p>
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-300 font-bold uppercase">
                    UNSHADED
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Official unshaded 60-item template with fiducials and zero marks.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-[#FF7A00] uppercase">
                <span>LOAD_&_EVALUATE</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Synthetic Generator Sheets */}
        <div className="pt-2 border-t border-[#272C33]">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            SYNTHETIC_GENERATOR_PRESETS
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sampleSheets.map((sample) => (
              <div
                key={sample.id}
                onClick={() => handleSelectSample(sample.options)}
                className="p-3 rounded-xs border border-[#272C33] bg-[#1C1F24] hover:border-[#FF7A00]/60 hover:bg-[#FF7A00]/5 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <p className="text-[11px] font-bold text-white group-hover:text-[#FF7A00] uppercase tracking-wide">
                    {sample.name}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                    {sample.description}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[10px] font-bold text-[#FF7A00] uppercase">
                  <span>LOAD_&_EVAL</span>
                  <ArrowRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
