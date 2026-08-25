import React, { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Zap, ZapOff, Play, CheckCircle2, AlertCircle, Scan, Sparkles, Sliders, Eye } from "lucide-react";

interface CameraViewfinderProps {
  onCaptureImage: (base64Image: string) => void;
  isProcessing: boolean;
}

export function CameraViewfinder({ onCaptureImage, isProcessing }: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoEnhance, setAutoEnhance] = useState(true);
  const [flashEffect, setFlashEffect] = useState(false);

  // List available video input devices
  useEffect(() => {
    async function getDevices() {
      try {
        const devList = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devList.filter((d) => d.kind === "videoinput");
        setDevices(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          const backCam = videoDevs.find((d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"));
          setSelectedDeviceId(backCam ? backCam.deviceId : videoDevs[0].deviceId);
        }
      } catch (err) {
        console.warn("Error enumerating video devices:", err);
      }
    }
    getDevices();
  }, [selectedDeviceId]);

  // Start Camera Stream with Progressive Fallback
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isMounted = true;

    async function startCamera() {
      setErrorMsg(null);

      // Clean up previous stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setErrorMsg("MediaDevices API is not supported in this browser environment. Please use file upload or open in a new tab.");
        }
        return;
      }

      // Progressive constraint strategy:
      // 1. Exact device ID or high-res 3:4 portrait
      // 2. Facing mode with standard 3:4
      // 3. Facing mode generic
      // 4. Basic video: true (universal fallback)
      const attempts: MediaStreamConstraints[] = [
        ...(selectedDeviceId
          ? [
              {
                video: {
                  deviceId: { exact: selectedDeviceId },
                  width: { ideal: 1440, min: 640 },
                  height: { ideal: 1920, min: 480 },
                },
                audio: false,
              },
              {
                video: { deviceId: { exact: selectedDeviceId } },
                audio: false,
              },
            ]
          : []),
        {
          video: {
            facingMode: { ideal: facingMode },
            aspectRatio: { ideal: 0.75 },
            width: { ideal: 1440, min: 640 },
            height: { ideal: 1920, min: 480 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: { ideal: facingMode },
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let lastError: any = null;
      for (const constraint of attempts) {
        if (!isMounted) return;
        try {
          const newStream = await navigator.mediaDevices.getUserMedia(constraint);
          if (!isMounted) {
            newStream.getTracks().forEach((t) => t.stop());
            return;
          }

          activeStream = newStream;
          setStream(newStream);

          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
            videoRef.current.play().catch(() => {});
          }

          const track = newStream.getVideoTracks()[0];
          const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
          if (capabilities.torch) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
            setTorchOn(false);
          }

          // Successfully obtained video stream
          return;
        } catch (err: any) {
          lastError = err;
          // Continue to next fallback constraint
        }
      }

      if (isMounted) {
        console.warn("All camera constraints failed:", lastError);
        const errMsg =
          lastError?.name === "NotAllowedError" || lastError?.name === "PermissionDeniedError"
            ? "Camera permission was denied. Please allow camera permissions in your browser or iframe settings."
            : lastError?.name === "NotReadableError" || lastError?.name === "TrackStartError"
            ? "Camera is already in use by another application or tab. Please close other apps using the camera."
            : "Could not start camera feed: " + (lastError?.message || "Device unavailable");
        setErrorMsg(errMsg);
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedDeviceId, facingMode]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn("Torch failed:", err);
    }
  };

  // Flip Camera
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setSelectedDeviceId("");
  };

  // Capture Frame strictly bounded to the 3:4 aspect ratio viewport
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    // Calculate exact 3:4 crop sub-rectangle corresponding to object-cover in 3:4 aspect ratio
    const targetAspect = 3 / 4; // 0.75
    const videoAspect = video.videoWidth / video.videoHeight;
    let srcX = 0;
    let srcY = 0;
    let srcW = video.videoWidth;
    let srcH = video.videoHeight;

    if (videoAspect > targetAspect) {
      // Video is wider than 3:4 (e.g. 16:9 or 4:3) - crop horizontal margins
      srcW = Math.round(video.videoHeight * targetAspect);
      srcH = video.videoHeight;
      srcX = Math.round((video.videoWidth - srcW) / 2);
      srcY = 0;
    } else {
      // Video is taller than 3:4 - crop vertical margins
      srcW = video.videoWidth;
      srcH = Math.round(video.videoWidth / targetAspect);
      srcX = 0;
      srcY = Math.round((video.videoHeight - srcH) / 2);
    }

    // Standard output resolution in exact 3:4 portrait (1440x1920 or native crop size)
    const outWidth = Math.min(1440, Math.max(900, srcW));
    const outHeight = Math.round(outWidth / targetAspect);

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw ONLY the 3:4 portion shown inside the viewfinder
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, outWidth, outHeight);

    if (autoEnhance) {
      const imgData = ctx.getImageData(0, 0, outWidth, outHeight);
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

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    onCaptureImage(dataUrl);
  };

  // 3-Second Timer Capture
  const handleTimedCapture = () => {
    if (countdown !== null) return;
    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        takeSnapshot();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  return (
    <div className="relative w-full overflow-hidden bg-[#0F1113] border border-slate-800 flex flex-col items-center font-mono">
      {/* Video Viewport Stage - 3:4 Aspect Ratio */}
      <div className="relative w-full max-w-[480px] aspect-[3/4] max-h-[640px] bg-[#16191C] flex items-center justify-center overflow-hidden border-x border-[#272C33]">
        {errorMsg ? (
          <div className="p-6 text-center max-w-md text-slate-300 flex flex-col items-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
            <p className="font-bold text-white uppercase tracking-wider text-xs mb-1">CAMERA_DEVICE_UNAVAILABLE</p>
            <p className="text-xs text-slate-400 mb-4">{errorMsg}</p>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDeviceId("");
                  setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
                }}
                className="px-4 py-2 bg-[#FF7A00] text-black rounded-xs text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-[0_0_10px_#FF7A00]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>RETRY_WITH_FALLBACK</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-4">
              Tip: If running inside an embedded iframe or preview, check browser permissions or switch to the <b>FILE_UPLOAD</b> tab.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Flash Effect on capture */}
            {flashEffect && <div className="absolute inset-0 bg-white z-30 pointer-events-none transition-opacity duration-200" />}

            {/* HUD Status Badges (Top Left & Top Right) */}
            <div className="absolute top-3 sm:top-4 left-3 sm:left-4 text-[10px] bg-black/75 px-2.5 py-1 border border-[#FF7A00]/40 text-[#FF7A00] flex items-center gap-1.5 backdrop-blur-sm z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] animate-pulse"></span>
              <span>FEED: 60 FPS</span>
            </div>

            <div className="absolute top-3 sm:top-4 right-3 sm:right-4 text-[10px] bg-black/75 px-2.5 py-1 border border-[#FF7A00]/50 text-white flex items-center gap-2 backdrop-blur-sm z-10">
              <span className="text-[#FF7A00] font-bold">3:4 PORTRAIT</span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400 font-bold">100% LOCK</span>
            </div>

            {/* OMR Geometric Alignment Frame */}
            <div className="absolute inset-3 sm:inset-6 md:inset-8 pointer-events-none border-2 border-dashed border-[#FF7A00]/30 flex items-center justify-center">
              {/* Corner 4-Axis Reticles */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Top-Left */}
                <div className="border-2 border-[#FF7A00] w-6 sm:w-7 h-6 sm:h-7 absolute top-0 left-0 border-r-0 border-b-0 shadow-[0_0_8px_#FF7A00]" />
                {/* Top-Right */}
                <div className="border-2 border-[#FF7A00] w-6 sm:w-7 h-6 sm:h-7 absolute top-0 right-0 border-l-0 border-b-0 shadow-[0_0_8px_#FF7A00]" />
                {/* Bottom-Left */}
                <div className="border-2 border-[#FF7A00] w-6 sm:w-7 h-6 sm:h-7 absolute bottom-0 left-0 border-r-0 border-t-0 shadow-[0_0_8px_#FF7A00]" />
                {/* Bottom-Right */}
                <div className="border-2 border-[#FF7A00] w-6 sm:w-7 h-6 sm:h-7 absolute bottom-0 right-0 border-l-0 border-t-0 shadow-[0_0_8px_#FF7A00]" />

                {/* Animated Tangerine Scanline */}
                <div className="w-[92%] h-[2px] bg-[#FF7A00] shadow-[0_0_12px_#FF7A00] absolute left-[4%] animate-scanline" />
              </div>

              {/* Center Alignment Instruction Box */}
              <div className="bg-black/75 backdrop-blur-md px-3 py-1 border border-[#FF7A00]/50 text-[#FF7A00] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center space-x-1.5 shadow-[0_0_12px_rgba(255,122,0,0.25)]">
                <Scan className="w-3.5 h-3.5 text-[#FF7A00] animate-pulse" />
                <span>ALIGN_ANSWER_SHEET_GRID</span>
              </div>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-[#0D0F12]/80 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="w-20 h-20 bg-[#FF7A00] text-black font-black text-4xl flex items-center justify-center shadow-[0_0_20px_#FF7A00] rounded-xs font-mono">
                  {countdown}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Camera Technical Toolbar */}
      <div className="w-full p-3 sm:p-3.5 bg-[#14171A] border-t border-[#272C33] flex flex-wrap items-center justify-between gap-3">
        {/* Left Options */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {devices.length > 1 && (
            <select
              id="camera-device-select"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-[#0D0F12] border border-slate-700 text-slate-200 text-[11px] font-mono px-2.5 py-1.5 focus:border-[#FF7A00] focus:outline-none rounded-xs uppercase min-h-[38px]"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label ? d.label.toUpperCase() : `OPTICAL_CAM_${i + 1}`}
                </option>
              ))}
            </select>
          )}

          <button
            id="flip-camera-btn"
            onClick={toggleCameraFacing}
            title="Switch Front/Back Sensor"
            className="p-2 min-h-[38px] min-w-[38px] rounded-xs bg-[#0D0F12] hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-[#FF7A00]/50 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {hasTorch && (
            <button
              id="toggle-torch-btn"
              onClick={toggleTorch}
              className={`p-2 min-h-[38px] min-w-[38px] rounded-xs border transition-colors flex items-center justify-center ${
                torchOn
                  ? "bg-[#FF7A00]/20 border-[#FF7A00] text-[#FF7A00] shadow-[0_0_10px_#FF7A00]"
                  : "bg-[#0D0F12] hover:bg-slate-800 border-slate-700 text-slate-400"
              }`}
              title={torchOn ? "Turn Flash Off" : "Turn Flash On"}
            >
              {torchOn ? <Zap className="w-4 h-4 text-[#FF7A00]" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          <button
            id="toggle-auto-enhance-btn"
            onClick={() => setAutoEnhance(!autoEnhance)}
            className={`px-2.5 py-1.5 min-h-[38px] rounded-xs text-[11px] font-bold font-mono border flex items-center space-x-1.5 transition-colors uppercase tracking-wider ${
              autoEnhance
                ? "bg-[#FF7A00]/15 border-[#FF7A00]/60 text-[#FF7A00]"
                : "bg-[#0D0F12] border-slate-700 text-slate-400"
            }`}
            title="Auto-enhance pencil marks contrast"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CONTRAST_BOOST</span>
          </button>
        </div>

        {/* Right Action Capture Buttons */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            id="timer-capture-btn"
            disabled={isProcessing || countdown !== null}
            onClick={handleTimedCapture}
            className="px-3 py-2 min-h-[40px] rounded-xs bg-[#0D0F12] hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold font-mono uppercase tracking-wider transition-all disabled:opacity-50"
            title="3-Second Timer Capture"
          >
            <span>3S_TIMER</span>
          </button>

          <button
            id="snapshot-capture-btn"
            disabled={isProcessing || !stream}
            onClick={takeSnapshot}
            className="flex-1 sm:flex-none px-6 py-2 min-h-[40px] rounded-xs bg-[#FF7A00] text-black font-black text-xs uppercase tracking-widest shadow-[0_0_12px_#FF7A00] flex items-center justify-center space-x-2 active:scale-95 transition-all hover:bg-[#FF8C1A] disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span>{isProcessing ? "PROCESSING_STREAM..." : "CAPTURE_&_SCAN"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
