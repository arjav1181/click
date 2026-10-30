"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Dialog, Field, Input, useToast } from "@click/ui";

/**
 * "New meeting" creates a real meeting row over POST /api/v1/meetings and
 * opens its workspace. "Record now" captures the microphone in the browser and
 * uploads the clip through POST /api/v1/uploads, which starts transcription.
 */
export function NewMeetingButton({ className }: { className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/v1/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || "Untitled meeting", source: "web" }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      meeting?: { id: string };
      error?: { message?: string };
    };
    setBusy(false);
    if (!response.ok || !payload.meeting) {
      setError(payload.error?.message ?? "The meeting could not be created.");
      return;
    }
    toast.push({ tone: "success", title: "Meeting created" });
    setOpen(false);
    router.push(`/app/meetings/${payload.meeting.id}`);
  };

  return (
    <>
      <Button size="sm" className={className} onClick={() => setOpen(true)}>
        New meeting
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New meeting"
        description="Create an empty meeting and add notes, or send a bot from the meeting workspace."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={busy} onClick={() => void create()}>
              Create meeting
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Title" htmlFor="new-meeting-title" error={error ?? undefined}>
            <Input
              id="new-meeting-title"
              value={title}
              placeholder="Weekly sync"
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function RecordNowButton({ className }: { className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot record audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void upload();
      };
      recorder.start();
      recorderRef.current = recorder;
      streamRef.current = stream;
      setRecording(true);
      setSeconds(0);
    } catch {
      setError("Microphone access was denied. Allow it in your browser to record.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  };

  const upload = async () => {
    setBusy(true);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    if (blob.size === 0) {
      setBusy(false);
      setError("Nothing was captured. Try recording again.");
      return;
    }
    const form = new FormData();
    form.append("file", new File([blob], "recording.webm", { type: "audio/webm" }));
    form.append("title", `Recording ${new Date().toLocaleString()}`);
    const response = await fetch("/api/v1/uploads", { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as {
      meeting?: { id: string };
      error?: { message?: string };
    };
    setBusy(false);
    if (!response.ok || !payload.meeting) {
      setError(payload.error?.message ?? "The recording could not be uploaded.");
      return;
    }
    toast.push({ tone: "success", title: "Recording uploaded", description: "Transcription has started." });
    router.push(`/app/meetings/${payload.meeting.id}`);
  };

  return (
    <div className={className}>
      {recording ? (
        <Button size="sm" className="w-full" onClick={stop}>
          Stop recording · {seconds}s
        </Button>
      ) : (
        <Button size="sm" className="w-full" loading={busy} onClick={() => void start()}>
          Record now
        </Button>
      )}
      {error ? (
        <Banner tone="danger" title="Recording unavailable" className="mt-2">
          {error}
        </Banner>
      ) : null}
    </div>
  );
}
