"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  exportMeeting,
  exportMeetings,
  EXPORT_FORMATS,
  type ExportFormat,
} from "@/lib/api";

interface ExportMeetingRow {
  id: string;
  title: string;
  startedAt: string | null;
  durationSeconds: number;
  source: string;
  status: string;
  hasTranscript: boolean;
  hasSummary: boolean;
  audioAvailable: boolean;
}

const FORMAT_META: Record<
  ExportFormat,
  { label: string; extension: string; description: string; needsAudio?: boolean }
> = {
  md: { label: "Markdown", extension: ".md", description: "AI notes and transcript as Markdown." },
  txt: { label: "Plain text", extension: ".txt", description: "Readable notes and a stamped transcript." },
  pdf: { label: "PDF", extension: ".pdf", description: "A print-ready document of the notes." },
  docx: { label: "Word", extension: ".docx", description: "An editable Word document." },
  srt: { label: "SubRip", extension: ".srt", description: "Subtitles for the transcript." },
  vtt: { label: "WebVTT", extension: ".vtt", description: "Web subtitles with speaker labels." },
  json: { label: "JSON", extension: ".json", description: "Everything, structured for scripts." },
  mp3: {
    label: "Audio",
    extension: ".mp3",
    description: "The original recording.",
    needsAudio: true,
  },
};

type ExportState =
  | { kind: "idle" }
  | { kind: "preparing"; count: number }
  | { kind: "ready"; count: number; filename: string; skipped: number }
  | { kind: "failed"; message: string };

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function ExportPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const preselect = searchParams.get("meeting");
  const [meetings, setMeetings] = useState<ExportMeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>("md");
  const [state, setState] = useState<ExportState>({ kind: "idle" });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/v1/meetings?limit=100");
      const payload = (await response.json().catch(() => ({}))) as {
        meetings?: ExportMeetingRow[];
        error?: { message?: string };
      };
      if (!response.ok) {
        setLoadError(payload.error?.message ?? "Your meetings could not be loaded.");
      } else {
        const rows = payload.meetings ?? [];
        setMeetings(rows);
        // The meeting screen links here with ?meeting=<id> so the meeting is
        // already selected.
        if (preselect && rows.some((meeting) => meeting.id === preselect)) {
          setSelected((prev) => (prev.includes(preselect) ? prev : [preselect]));
        }
      }
    } catch {
      setLoadError("We could not reach the server. Check your connection and try again.");
    }
    setLoading(false);
  }, [preselect]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return meetings;
    return meetings.filter((meeting) => meeting.title.toLowerCase().includes(needle));
  }, [meetings, query]);

  const selectedMeetings = useMemo(
    () => meetings.filter((meeting) => selected.includes(meeting.id)),
    [meetings, selected],
  );

  const missingAudio = useMemo(
    () => selectedMeetings.filter((meeting) => !meeting.audioAvailable),
    [selectedMeetings],
  );

  const allVisibleSelected =
    visible.length > 0 && visible.every((meeting) => selected.includes(meeting.id));

  const toggle = (id: string) => {
    setState({ kind: "idle" });
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setState({ kind: "idle" });
    setSelected((prev) => {
      if (allVisibleSelected) {
        const visibleIds = new Set(visible.map((meeting) => meeting.id));
        return prev.filter((id) => !visibleIds.has(id));
      }
      const next = new Set(prev);
      for (const meeting of visible) next.add(meeting.id);
      return Array.from(next);
    });
  };

  const run = async () => {
    if (selected.length === 0) return;
    setState({ kind: "preparing", count: selected.length });
    const result =
      selected.length === 1
        ? await exportMeeting(selected[0], format)
        : await exportMeetings(selected, format);
    if (!result.data) {
      setState({ kind: "failed", message: result.error ?? "That export did not work." });
      return;
    }
    saveBlob(result.data.blob, result.data.filename);
    setState({
      kind: "ready",
      count: selected.length,
      filename: result.data.filename,
      skipped: result.data.skipped,
    });
    toast.push({
      tone: "success",
      title:
        selected.length === 1 ? "Export ready" : `${selected.length} meetings exported`,
      description: result.data.filename,
    });
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Export</h2>
        <p className="text-sm text-text-muted">
          Take your notes, transcripts and recordings out of Click. Nothing leaves this instance until you
          download the file.
        </p>
      </div>

      {loadError ? (
        <Banner
          tone="danger"
          title="Your meetings could not be loaded"
          className="mb-4"
          action={
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          }
        >
          {loadError}
        </Banner>
      ) : null}

      {state.kind === "failed" ? (
        <Banner tone="danger" title="Export failed" className="mb-4">
          {state.message}
        </Banner>
      ) : null}

      {state.kind === "ready" ? (
        <Banner tone="success" title="Export ready" className="mb-4">
          Saved <span className="mono">{state.filename}</span>
          {state.skipped > 0 ? ` · ${state.skipped} meeting(s) were skipped` : ""}.
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <CardHeader
            title="Meetings"
            description="Pick the meetings you want to take with you."
            actions={
              <Button variant="ghost" size="sm" onClick={toggleAll} disabled={visible.length === 0}>
                {allVisibleSelected ? "Clear selection" : "Select all"}
              </Button>
            }
          />
          <div className="grid gap-3 p-4">
            <Field label="Search" htmlFor="export-search">
              <Input
                id="export-search"
                value={query}
                placeholder="Search titles…"
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>

            {loading ? (
              <div className="grid gap-2">
                <Skeleton className="h-14" rounded="lg" />
                <Skeleton className="h-14" rounded="lg" />
                <Skeleton className="h-14" rounded="lg" />
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                title={meetings.length === 0 ? "No meetings yet" : "Nothing matches that search"}
                description={
                  meetings.length === 0
                    ? "Once a meeting has a transcript you can export it from here."
                    : "Try a different title."
                }
              />
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {visible.map((meeting) => {
                  const checked = selected.includes(meeting.id);
                  return (
                    <li key={meeting.id} className="flex items-start gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--color-accent)]"
                        checked={checked}
                        onChange={() => toggle(meeting.id)}
                        aria-label={`Select ${meeting.title}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-text">{meeting.title}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {meeting.startedAt
                            ? new Date(meeting.startedAt).toLocaleDateString()
                            : "No date"}{" "}
                          · {Math.round(meeting.durationSeconds / 60)} min · {meeting.source}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        {meeting.hasSummary ? <Badge tone="success">Notes</Badge> : null}
                        {meeting.hasTranscript ? <Badge tone="accent">Transcript</Badge> : null}
                        {meeting.audioAvailable ? <Badge tone="neutral">Audio</Badge> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader title="Format" description="One format for the whole export." />
            <div className="grid gap-2 p-4">
              {EXPORT_FORMATS.map((option) => {
                const meta = FORMAT_META[option];
                const active = format === option;
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                      active
                        ? "border-accent bg-accent-soft"
                        : "border-border hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="export-format"
                      className="mt-1 size-4 accent-[var(--color-accent)]"
                      checked={active}
                      onChange={() => {
                        setFormat(option);
                        setState({ kind: "idle" });
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text">{meta.label}</span>
                        <span className="mono text-xs text-text-muted">{meta.extension}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">{meta.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Export" description="Your file downloads straight to this device." />
            <div className="grid gap-3 p-4">
              {selected.length === 0 ? (
                <p className="text-xs text-text-muted">
                  Select one or more meetings to enable the export.
                </p>
              ) : (
                <p className="text-xs text-text-muted">
                  {selected.length} meeting{selected.length === 1 ? "" : "s"} selected ·{" "}
                  {FORMAT_META[format].label}
                </p>
              )}

              {format === "mp3" && missingAudio.length > 0 ? (
                <Banner tone="warning" title="Some meetings have no recording">
                  {missingAudio.length} selected meeting(s) have no stored audio. They will be skipped.
                </Banner>
              ) : null}

              {selected.length > 1 ? (
                <p className="text-xs text-text-muted">
                  Multiple meetings are bundled into one zip archive.
                </p>
              ) : null}

              <Button
                size="sm"
                onClick={() => void run()}
                loading={state.kind === "preparing"}
                disabled={selected.length === 0 || state.kind === "preparing"}
              >
                {selected.length <= 1 ? "Download" : `Download ${selected.length} meetings`}
              </Button>

              {state.kind === "preparing" ? (
                <p className="text-xs text-text-muted">
                  Preparing {state.count} file{state.count === 1 ? "" : "s"}…
                </p>
              ) : null}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
