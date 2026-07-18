import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { colors } from "../lib/theme";

// Full-screen camera overlay that decodes a QR code from the rear camera and
// reports the raw decoded text back to the caller. Mirrors FaceMonitor's
// pattern elsewhere in this app: a raw getUserMedia + <video> + requestAnimationFrame
// loop, sampled through an offscreen canvas for jsQR rather than a bundled
// scanner component.
export default function QrScanner({ onDecode, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        loop();
      } catch {
        if (!cancelled) setError("Camera access denied — enter the code below instead.");
      }
    }

    function loop() {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(frame.data, frame.width, frame.height);
      if (result?.data) {
        onDecode(result.data);
        return; // stop sampling once found; the caller unmounts us next
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <video ref={videoRef} muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "relative", width: 220, height: 220, border: "3px solid rgba(255,255,255,.85)", borderRadius: 24, boxShadow: "0 0 0 999px rgba(0,0,0,.45)" }} />
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 22px)", left: 22, right: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Point at the driver's QR code</span>
        <button
          onClick={onClose}
          aria-label="Close scanner"
          style={{ width: 36, height: 36, borderRadius: 14, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontSize: 16, cursor: "pointer" }}
        >
          ✕
        </button>
      </div>
      {error && (
        <div style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)", left: 22, right: 22, background: "rgba(255,85,69,.16)", border: "1px solid rgba(255,85,69,.4)", borderRadius: 16, padding: "12px 14px", textAlign: "center" }}>
          <span style={{ fontSize: 13, color: colors.textLight }}>{error}</span>
        </div>
      )}
    </div>
  );
}
