import * as React from "react";
import { cn } from "./utils";
import { Badge, CitationChip, type CitationOrigin } from "./badge";

export function formatTimestamp(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SpeakerLabel({
  name,
  me,
  unnamed,
  className,
}: {
  name?: string | null;
  me?: boolean;
  unnamed?: boolean;
  className?: string;
}) {
  if (!name) {
    return (
      <span className={cn("text-sm font-semibold italic text-text-muted", className)}>
        Unnamed speaker
      </span>
    );
  }
  if (unnamed) {
    return (
      <span className={cn("text-sm font-semibold italic text-text-muted", className)}>{name}</span>
    );
  }
  return (
    <span className={cn("text-sm font-semibold text-text", me && "text-accent", className)}>
      {name}
      {me ? " (me)" : null}
    </span>
  );
}

export function TimestampLink({
  ms,
  onJump,
  className,
}: {
  ms: number;
  onJump?: (ms: number) => void;
  className?: string;
}) {
  const label = formatTimestamp(ms);
  const body = (
    <span className={cn("mono text-xs text-text-muted hover:text-accent", className)}>
      {label}
    </span>
  );
  if (!onJump) return body;
  return (
    <button
      type="button"
      onClick={() => onJump(ms)}
      aria-label={`Jump to ${label}`}
      className="rounded-sm underline-offset-2 hover:underline"
    >
      {body}
    </button>
  );
}

export interface TranscriptSegmentData {
  id: string;
  speakerName: string | null;
  speakerIsMe?: boolean;
  startMs: number;
  endMs: number;
  text: string;
  edited?: boolean;
  confidence?: number;
}

export function TranscriptSegment({
  segment,
  onJump,
  highlight,
  className,
}: {
  segment: TranscriptSegmentData;
  onJump?: (ms: number) => void;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[88px_1fr] gap-3 rounded-md px-2 py-2 sm:grid-cols-[120px_1fr]",
        highlight && "bg-warning-soft",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-1 pt-0.5">
        <SpeakerLabel
          name={segment.speakerName}
          me={segment.speakerIsMe}
          unnamed={!segment.speakerName}
        />
        <TimestampLink ms={segment.startMs} onJump={onJump} />
      </div>
      <div className="min-w-0">
        <p className="text-base leading-6 text-text">{segment.text}</p>
        {segment.edited ? (
          <p className="mt-1 text-xs text-text-muted">Edited after transcription</p>
        ) : null}
      </div>
    </div>
  );
}

export function SourceTag({
  origin,
  label,
  onClick,
}: {
  origin: CitationOrigin;
  label: string;
  onClick?: () => void;
}) {
  return <CitationChip origin={origin} label={label} onClick={onClick} />;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ready" || status === "sent" || status === "done"
      ? "success"
      : status === "failed" || status === "error"
        ? "danger"
        : status === "processing" || status === "live" || status === "joining"
          ? "accent"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}
