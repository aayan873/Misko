"use client";

import { useEffect, useRef, useState } from "react";

interface CameraCaptureProps {
  onCapture: (result: { base64: string; mimeType: string }) => void;
  onClose: () => void;
}

const MAX_DIMENSION = 1400;

/**
 * A live webcam preview with a capture button (prompt_v2.md A2) — the vision
 * endpoint (/api/transcribe-work) already existed and worked, but the only way
 * to reach it was a file picker, which on a phone opens the native camera app
 * (invisible in a screen recording) and on desktop is just "trust me, I picked
 * a file" — neither is demoable. This is mostly frontend work for exactly that
 * reason: hold a piece of handwritten work up to a laptop's own webcam during
 * a live demo and watch it get read in real time, instead of an off-screen
 * photo picker.
 *
 * getUserMedia requires a secure context (https, or localhost for dev) — every
 * deployment target here (Vercel, npm run dev on localhost) satisfies that.
 */
export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't access the camera — check your browser's camera permission.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Couldn't capture that frame — your browser doesn't support canvas.");
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    const mimeType = "image/jpeg";
    const dataUrl = canvas.toDataURL(mimeType, 0.82);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    onCapture({ base64, mimeType });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-[520px] p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[14px] font-semibold text-ink">Show your work to the camera</p>
          <button type="button" onClick={onClose} className="text-[13px] text-ink-faint hover:text-ink">
            Cancel
          </button>
        </div>

        {error ? (
          <p className="py-8 text-center text-[13.5px] text-danger">{error}</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "4 / 3" }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            </div>
            <button
              type="button"
              onClick={capture}
              disabled={!ready}
              className="btn-primary mt-4 w-full disabled:opacity-50"
            >
              {ready ? "Capture" : "Starting camera…"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
