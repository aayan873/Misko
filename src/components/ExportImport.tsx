"use client";

import { useState } from "react";

interface ExportImportProps {
  learnerId: string;
  onImported?: () => void;
}

/**
 * This app has no accounts (see learnerModel.ts's "Export / import" section
 * for why) — progress lives only in this browser's localStorage-derived id.
 * Export gives the learner a real backup of their own data; import restores
 * one, replacing whatever this browser currently has for this learner id.
 */
export default function ExportImport({ learnerId, onImported }: ExportImportProps) {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleExport() {
    const res = await fetch(`/api/export?learnerId=${learnerId}`);
    if (!res.ok) {
      setMessage({ text: "Couldn't export right now — try again.", isError: true });
      return;
    }
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `misko-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    const confirmed = window.confirm(
      "This replaces everything Misko currently knows about you in this browser with the file you're uploading. This can't be undone. Continue?"
    );
    if (!confirmed) return;

    setImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId,
          data: {
            conceptMastery: parsed.conceptMastery ?? [],
            misconceptionEvents: parsed.misconceptionEvents ?? [],
            attempts: parsed.attempts ?? [],
            spotMistakeAttempts: parsed.spotMistakeAttempts ?? [],
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMessage({ text: body.error ?? "Import failed.", isError: true });
        return;
      }
      setMessage({ text: "Restored. Refreshing your data…", isError: false });
      onImported?.();
    } catch {
      setMessage({ text: "That file doesn't look like a valid Misko export.", isError: true });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={handleExport} className="btn-secondary">
        Export my progress
      </button>
      <label className="btn-secondary cursor-pointer">
        {importing ? "Restoring…" : "Restore from backup"}
        <input
          type="file"
          accept="application/json"
          disabled={importing}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleImportFile(file);
          }}
        />
      </label>
      {message && (
        <span className={`text-[13px] ${message.isError ? "text-danger" : "text-success"}`}>{message.text}</span>
      )}
    </div>
  );
}
