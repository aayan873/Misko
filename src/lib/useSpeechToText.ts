"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Thin wrapper around the browser's native SpeechRecognition API — no backend
 * involvement, the transcript just becomes typed text in the existing
 * "show your work" field, so it goes through the exact same classification
 * pipeline as if the learner had typed it. Not supported in every browser
 * (notably Firefox); callers should hide the mic control when !supported.
 */
export function useSpeechToText(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognitionCtor: { new (): SpeechRecognition } | undefined =
    typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;
  const supported = Boolean(SpeechRecognitionCtor);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [SpeechRecognitionCtor, onResult]);

  return { supported, listening, start, stop };
}
