import * as React from "react";
import { cn } from "./utils";
import { Badge } from "./badge";
import { StatusBadge } from "./transcript";

export interface MeetingSummary {
  id: string;
  title: string;
  startedAt: string;
  durationSeconds: number;
  source: string;
  status: string;
  language?: string | null;
  participantCount?: number;
  folderName?: string | null;
  hasTranscript?: boolean;
  hasSummary?: boolean;
  ownerName?: string | null;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function MeetingCard({
  meeting,
  onOpen,
  selected,
  className,
}: {
  meeting: MeetingSummary;
  onOpen?: (id: string) => void;
  selected?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card transition-shadow hover:shadow-pop",
        selected ? "border-accent" : "border-border",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-text">{meeting.title}</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {new Date(meeting.startedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {" · "}
            {formatDuration(meeting.durationSeconds)}
          </p>
        </div>
        <StatusBadge status={meeting.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>{meeting.source}</Badge>
        {meeting.language ? <Badge>{meeting.language}</Badge> : null}
        {meeting.participantCount ? (
          <Badge>
            {meeting.participantCount} participant{meeting.participantCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
        {meeting.folderName ? <Badge>{meeting.folderName}</Badge> : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-text-muted">
          {meeting.ownerName ? `Owned by ${meeting.ownerName}` : "No owner assigned"}
        </p>
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(meeting.id)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-2"
          >
            Open
          </button>
        ) : null}
      </div>
    </article>
  );
}
