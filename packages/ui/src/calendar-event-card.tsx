import * as React from "react";
import { cn } from "./utils";
import { Badge } from "./badge";

export interface CalendarEventSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetingUrl?: string | null;
  autoJoin?: boolean;
  botStatus?: "none" | "scheduled" | "joining" | "joined" | "declined";
  cancelled?: boolean;
}

export function CalendarEventCard({
  event,
  action,
  className,
}: {
  event: CalendarEventSummary;
  action?: React.ReactNode;
  className?: string;
}) {
  const starts = new Date(event.startsAt);
  const live = starts.getTime() <= Date.now() && new Date(event.endsAt).getTime() > Date.now();

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border bg-surface p-3",
        live ? "border-accent" : "border-border",
        event.cancelled && "opacity-60",
        className,
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            event.cancelled ? "text-text-muted line-through" : "text-text",
          )}
        >
          {event.title}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {starts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} –{" "}
          {new Date(event.endsAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {live ? <Badge tone="accent">Live now</Badge> : null}
        {event.autoJoin ? <Badge tone="success">Bot joins</Badge> : null}
        {event.botStatus && event.botStatus !== "none" ? (
          <Badge tone={event.botStatus === "declined" ? "danger" : "accent"}>{event.botStatus}</Badge>
        ) : null}
        {action}
      </div>
    </div>
  );
}
