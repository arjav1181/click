"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
} from "@click/ui";
import { getMeeting, listTranscriptSegments } from "@/lib/api";
import type { Meeting, TranscriptSegment } from "@click/core";
import Link from "next/link";

export default function LiveMeetingPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getMeeting(id), listTranscriptSegments(id)]).then(([m, segs]) => {
      if (!active) return;
      setMeeting(m);
      setSegments(segs);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="h-96" rounded="lg" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <EmptyState title="Meeting not found" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-text">{meeting.title}</h2>
            <Badge tone="danger">Live</Badge>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {meeting.participantCount} participants · {meeting.source}
          </p>
        </div>
        <Link href={`/app/meetings/${id}`}>
          <Button variant="secondary" size="sm">
            Open workspace
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Live transcript" description="Segments stream in as they are captured." />
          <div className="grid gap-1 p-4">
            {segments.length === 0 ? (
              <p className="text-sm text-text-muted">Waiting for transcript…</p>
            ) : (
              segments.map((segment) => (
                <div key={segment.id} className="flex gap-3 text-sm">
                  <span className="mono w-12 shrink-0 text-xs text-text-muted">
                    {Math.floor(segment.startMs / 60000)}:{String(Math.floor((segment.startMs % 60000) / 1000)).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-text">{segment.speakerName ?? "Speaker"}: </span>
                    <span className="text-text">{segment.text}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <aside className="grid gap-4">
          <Card>
            <CardHeader title="Capture" description="Live status." />
            <div className="grid gap-2 p-4 text-sm text-text-muted">
              <p>Status: {meeting.status}</p>
              <p>Audio available: {meeting.audioAvailable ? "yes" : "no"}</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
