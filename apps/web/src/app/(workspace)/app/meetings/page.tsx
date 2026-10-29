"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardHeader, Badge, EmptyState, Input, Select, Skeleton } from "@click/ui";
import { listMeetings } from "@/lib/api";
import { MeetingCard } from "@click/ui";
import Link from "next/link";
import type { Meeting } from "@click/core";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    listMeetings({ q: query || undefined, status: status || undefined })
      .then((result) => {
        if (active) {
          setMeetings(result.meetings);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [query, status]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text">Meetings</h2>
          <p className="text-sm text-text-muted">Browse, filter and act on your meetings.</p>
        </div>
        <Link href="/app/import">
          <Button size="sm">Import recording</Button>
        </Link>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="q">
              Search
            </label>
            <Input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles…"
            />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="status">
              Status
            </label>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="live">Live</option>
              <option value="failed">Failed</option>
              <option value="scheduled">Scheduled</option>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setStatus("");
            }}
          >
            Clear
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" rounded="lg" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <EmptyState
            title="No meetings match"
            description="Try a different search or import a recording."
            action={
              <Link href="/app/import">
                <Button variant="secondary" size="sm">
                  Import recording
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <Link key={meeting.id} href={`/app/meetings/${meeting.id}`} className="block">
              <MeetingCard
                meeting={{
                  id: meeting.id,
                  title: meeting.title,
                  startedAt: meeting.startedAt,
                  durationSeconds: meeting.durationSeconds,
                  source: meeting.source,
                  status: meeting.status,
                  language: meeting.language,
                  participantCount: meeting.participantCount,
                  folderName: meeting.folderName,
                  ownerName: meeting.ownerName,
                }}
              />
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Badge tone="neutral">{meetings.length} meetings</Badge>
      </div>
    </div>
  );
}
