import { useRef, useEffect, useState, useCallback } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        if (active) onClose();
      }
    }

    start();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onClose]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "camera-capture.png", { type: "image/png" });
      onCapture(file);
    }, "image/png");
  }, [onCapture]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 z-10 text-white/80 hover:text-white bg-black/40 rounded-full p-1"
        aria-label="Close camera"
      >
        <X className="h-4 w-4" />
      </button>

      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full max-h-52 object-cover"
      />
      {ready && (
        <div className="flex justify-center py-3 bg-black/60">
          <Button
            type="button"
            size="sm"
            onClick={capture}
            className="gap-2 rounded-full px-6"
          >
            <Camera className="h-4 w-4" />
            Capture
          </Button>
        </div>
      )}
    </div>
  );
}

export function isCameraAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}
