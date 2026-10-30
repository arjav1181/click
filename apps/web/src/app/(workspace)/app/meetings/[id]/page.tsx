"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Tabs,
  Card,
  CardHeader,
  Badge,
  Banner,
  Dialog,
  EmptyState,
  Skeleton,
  Textarea,
  Input,
  Select,
  CitationChip,
} from "@click/ui";
import { generateNote, getMeeting, getNote, listActionItems, listTranscriptSegments, saveNote, fetchShares, createShare, revokeShare, type PublicShareRow } from "@/lib/api";
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shares, setShares] = useState<PublicShareRow[]>([]);
  const [shareAccess, setShareAccess] = useState<"link" | "domain" | "password">("link");
  const [sharePassword, setSharePassword] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [revealedLink, setRevealedLink] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getMeeting(id), listTranscriptSegments(id), getNote(id), listActionItems()])
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

  const loadShares = useCallback(async () => {
    const result = await fetchShares(id);
    if (result.data) setShares(result.data.shares);
  }, [id]);

  useEffect(() => {
    if (shareOpen) void loadShares();
  }, [shareOpen, loadShares]);

  const createShareLink = async () => {
    setShareBusy(true);
    setShareError(null);
    const result = await createShare(id, {
      access: shareAccess,
      password: shareAccess === "password" ? sharePassword : undefined,
    });
    setShareBusy(false);
    if (!result.data) {
      setShareError(result.error ?? "That share could not be created.");
      return;
    }
    setRevealedLink(result.data.link);
    setSharePassword("");
    await loadShares();
  };

  const revokeShareLink = async (shareId: string) => {
    const result = await revokeShare(id, shareId);
    if (result.error) return;
    await loadShares();
  };

  const saveRaw = async () => {
    setSaving(true);
    const updated = await saveNote(id, raw);
    setNote(updated);
    setSaving(false);
  };

  const generate = async () => {
    setGenerating(true);
    const updated = await generateNote(id, note?.templateId ?? undefined);
    setNote(updated);
    setRaw(updated?.rawMarkdown ?? raw);
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
          <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
            Share
          </Button>
          <Link href={`/app/export?meeting=${id}`}>
            <Button variant="ghost" size="sm">
              Export
            </Button>
          </Link>
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

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} title="Share this meeting" size="lg">
        {revealedLink ? (
          <Banner tone="success" title="Share link ready">
            <span className="mono break-all text-xs">{revealedLink}</span>
          </Banner>
        ) : null}
        {shareError ? <p className="text-xs text-danger">{shareError}</p> : null}

        <div className="grid gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="share-access">
                Access
              </label>
              <Select
                id="share-access"
                value={shareAccess}
                onChange={(event) => setShareAccess(event.target.value as "link" | "domain" | "password")}
              >
                <option value="link">Anyone with the link</option>
                <option value="domain">Workspace domain</option>
                <option value="password">Password protected</option>
              </Select>
            </div>
            {shareAccess === "password" ? (
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="share-password">
                  Password
                </label>
                <Input
                  id="share-password"
                  type="password"
                  value={sharePassword}
                  onChange={(event) => setSharePassword(event.target.value)}
                />
              </div>
            ) : null}
            <Button size="sm" loading={shareBusy} onClick={() => void createShareLink()}>
              Create link
            </Button>
          </div>

          {shares.length === 0 ? (
            <p className="text-xs text-text-muted">No active share links yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {shares.map((share) => (
                <li key={share.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">
                      {share.access === "link"
                        ? "Anyone with the link"
                        : share.access === "domain"
                          ? "Workspace domain"
                          : "Password protected"}
                    </p>
                    <p className="text-xs text-text-muted">
                      Created {new Date(share.createdAt).toLocaleDateString()}
                      {share.revokedAt ? " · revoked" : ""}
                      {share.expiresAt ? ` · expires ${new Date(share.expiresAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  {!share.revokedAt ? (
                    <Button variant="danger" size="sm" onClick={() => void revokeShareLink(share.id)}>
                      Revoke
                    </Button>
                  ) : (
                    <Badge tone="danger">Revoked</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </div>
  );
}
