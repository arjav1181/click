"use client";

import { useRef, useState } from "react";
import { Button, Card, CardHeader, Badge, EmptyState, Skeleton } from "@click/ui";
import { uploadRecording } from "@/lib/api";
import type { Meeting } from "@click/core";
import Link from "next/link";

type UploadState = "idle" | "uploading" | "transcribing" | "done" | "failed";

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Meeting | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list));
    setState("idle");
    setResult(null);
    setError(null);
  };

  const start = async () => {
    if (files.length === 0) return;
    setError(null);
    setState("uploading");
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => (p >= 90 ? 90 : p + 8));
    }, 200);
    try {
      const meeting = await uploadRecording({ name: files[0].name, size: files[0].size, file: files[0], title: files[0].name.replace(/\.[^.]+$/, "") });
      clearInterval(timer);
      setProgress(100);
      setState("transcribing");
      await new Promise((r) => setTimeout(r, 600));
      setState("done");
      setResult(meeting);
    } catch {
      clearInterval(timer);
      setState("failed");
      setError("Upload failed. Check the file format and try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="text-xl font-semibold text-text">Import recording</h2>
      <p className="mb-4 text-sm text-text-muted">
        Upload audio or video. We transcribe it and build notes with citations.
      </p>

      <Card className="p-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-input bg-surface-2 px-6 py-12 text-center hover:border-accent hover:bg-accent-soft/40"
        >
          <p className="text-sm font-semibold text-text">Drop a file here or click to browse</p>
          <p className="text-xs text-text-muted">Audio or video, up to 5 GB. Common codecs supported.</p>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>

        {files.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="truncate text-text">{file.name}</span>
                <span className="text-xs text-text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
        ) : null}

        {state === "uploading" || state === "transcribing" ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{state === "uploading" ? "Uploading…" : "Transcribing…"}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-pill bg-surface-2">
              <div className="h-full rounded-pill bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        {state === "done" && result ? (
          <div className="mt-4 rounded-md border border-success bg-success-soft px-4 py-3 text-sm">
            <p className="font-semibold text-success">Import complete</p>
            <p className="mt-1 text-text">
              "{result.title}" is ready.{" "}
              <Link href={`/app/meetings/${result.id}`} className="text-accent hover:underline">
                Open meeting
              </Link>
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setFiles([]);
              setState("idle");
              setResult(null);
              setError(null);
              setProgress(0);
            }}
            disabled={state === "uploading" || state === "transcribing"}
          >
            Clear
          </Button>
          <Button
            onClick={start}
            loading={state === "uploading" || state === "transcribing"}
            disabled={files.length === 0 || state === "uploading" || state === "transcribing"}
          >
            Import
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Recent imports" description="Files you've uploaded recently." />
        <div className="p-4">
          <EmptyState
            title="No recent imports"
            description="Uploaded recordings show up here once processed."
          />
        </div>
      </Card>
    </div>
  );
}
