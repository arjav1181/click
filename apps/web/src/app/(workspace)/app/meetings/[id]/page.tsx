"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Tabs,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  Skeleton,
  Textarea,
  Input,
  CitationChip,
} from "@click/ui";
import { data } from "@click/core";
import { TranscriptSegment as TranscriptSegmentUI } from "@click/ui";
import type { Meeting, TranscriptSegment, Note, ActionItem } from "@click/core";
import Link from "next/link";
import { StatusBadge } from "@click/ui";

export default function MeetingWorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [tab, setTab] = useState("notes");
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([data.getMeeting(id), data.listTranscriptSegments(id), data.getNote(id), data.listActionItems()])
      .then(([m, segs, n, acts]) => {
        if (!active) return;
        setMeeting(m);
        setSegments(segs);
        setNote(n);
        setRaw(n?.rawMarkdown ?? "");
        setActions(acts.filter((a) => a.meetingId === id));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const saveRaw = async () => {
    setSaving(true);
    const updated = await data.saveNote(id, raw);
    setNote(updated);
    setSaving(false);
  };

  const generate = async () => {
    setGenerating(true);
    const updated = await data.generateNote(id, note?.templateId ?? "t_default");
    setNote(updated);
    setRaw(updated.rawMarkdown);
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Skeleton className="mb-4 h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96" rounded="lg" />
          <Skeleton className="h-96" rounded="lg" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <EmptyState title="Meeting not found" description="It may have been deleted or moved to trash." />
      </div>
    );
  }

  const tabItems = [
    { id: "notes", label: "AI notes" },
    { id: "raw", label: "Raw notes" },
    { id: "transcript", label: "Transcript" },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-semibold text-text">{meeting.title}</h2>
            <StatusBadge status={meeting.status} />
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {new Date(meeting.startedAt).toLocaleString()} · {Math.round(meeting.durationSeconds / 60)} min ·{" "}
            {meeting.source} · {meeting.participantCount} participants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/meetings/${id}/follow-up`}>
            <Button variant="secondary" size="sm">
              Follow-up
            </Button>
          </Link>
          <Button variant="secondary" size="sm">
            Share
          </Button>
          <Button variant="ghost" size="sm">
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Card>
            <div className="border-b border-border px-4 py-2">
              <Tabs items={tabItems} value={tab} onChange={setTab} />
            </div>

            <div className="p-4">
              {tab === "notes" ? (
                note && note.sections.length > 0 ? (
                  <div className="grid gap-4">
                    {note.sections.map((section) => (
                      <section key={section.id}>
                        <h3 className="text-base font-semibold text-text">{section.title}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">{section.body}</p>
                      </section>
                    ))}
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {note.citations.map((c) => (
                        <CitationChip
                          key={c.id}
                          origin={c.origin}
                          label={c.label}
                          title={c.quote}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={generate} loading={generating}>
                        Regenerate
                      </Button>
                      <Button variant="secondary" size="sm">
                        Change template
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No AI notes yet"
                    description="Generate a structured summary with citations from the transcript."
                    action={
                      <Button size="sm" onClick={generate} loading={generating}>
                        Generate notes
                      </Button>
                    }
                  />
                )
              ) : null}

              {tab === "raw" ? (
                <div className="grid gap-3">
                  <Textarea
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    rows={14}
                    placeholder="Write your own notes here. The AI uses them to steer the summary."
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-muted">
                      {raw.length} characters. Auto-saves on blur.
                    </p>
                    <Button size="sm" onClick={saveRaw} loading={saving}>
                      Save notes
                    </Button>
                  </div>
                </div>
              ) : null}

              {tab === "transcript" ? (
                segments.length === 0 ? (
                  <EmptyState title="No transcript" description="Transcription is still in progress." />
                ) : (
                  <div className="grid gap-1">
                    {segments.map((segment) => (
                      <TranscriptSegmentUI
                        key={segment.id}
                        segment={{
                          id: segment.id,
                          speakerName: segment.speakerName,
                          speakerIsMe: segment.speakerIsMe,
                          startMs: segment.startMs,
                          endMs: segment.endMs,
                          text: segment.text,
                          edited: segment.edited,
                          confidence: segment.confidence,
                        }}
                      />
                    ))}
                  </div>
                )
              ) : null}
            </div>
          </Card>
        </div>

        <aside className="grid gap-4">
          <Card>
            <CardHeader title="Outline" description="Jump to a moment." />
            <div className="grid gap-1 p-3">
              {segments.length === 0 ? (
                <p className="text-xs text-text-muted">No sections yet.</p>
              ) : (
                segments.map((segment) => (
                  <button
                    key={segment.id}
                    type="button"
                    className="flex items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs hover:bg-surface-2"
                  >
                    <span className="truncate text-text-muted">
                      {segment.speakerName ?? "Speaker"}: {segment.text.slice(0, 40)}
                    </span>
                    <span className="mono text-text-muted">
                      {Math.floor(segment.startMs / 60000)}:{String(Math.floor((segment.startMs % 60000) / 1000)).padStart(2, "0")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Action items" description="Commitments from this meeting." />
            <div className="grid gap-2 p-3">
              {actions.length === 0 ? (
                <p className="text-xs text-text-muted">No action items extracted yet.</p>
              ) : (
                actions.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-sm border border-border bg-surface-2 px-2 py-1.5 text-xs"
                  >
                    <p className="text-text">{action.text}</p>
                    <p className="mt-0.5 text-text-muted">
                      {action.assigneeName ?? "Unassigned"}
                      {action.dueAt ? ` · due ${new Date(action.dueAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Player" description="Listen with synced text." />
            <div className="p-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary">
                  ▶ Play
                </Button>
                <span className="text-xs text-text-muted">Audio available: {meeting.audioAvailable ? "yes" : "no"}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
