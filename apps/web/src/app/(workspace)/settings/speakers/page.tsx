"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  Input,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  fetchSpeakers,
  mergeSpeakers,
  renameSpeaker,
  type SpeakerRow,
} from "@/lib/api";

export default function SpeakersPage() {
  const toast = useToast();
  const [speakers, setSpeakers] = useState<SpeakerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SpeakerRow | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState<SpeakerRow | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchSpeakers();
    if (result.data) setSpeakers(result.data.speakers);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = speakers.filter((speaker) => !speaker.mergedIntoId);

  const saveName = async () => {
    if (!editing) return;
    if (!name.trim()) {
      setFormError("Give the speaker a name.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const result = await renameSpeaker(editing.id, name.trim());
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setEditing(null);
    toast.push({ tone: "success", title: "Speaker renamed" });
    await load();
  };

  const doMerge = async () => {
    if (!mergeSource || !mergeTarget) return;
    setSaving(true);
    const result = await mergeSpeakers(mergeSource.id, mergeTarget);
    setSaving(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Merge failed", description: result.error });
      return;
    }
    setMergeSource(null);
    setMergeTarget("");
    toast.push({ tone: "success", title: "Speakers merged" });
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Speaker management</h2>
        <p className="text-sm text-text-muted">
          Rename the people Click hears in your meetings, and merge duplicates into one identity.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Speakers could not be loaded"
          className="mb-4"
          action={
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-20" rounded="lg" />
          <Skeleton className="h-20" rounded="lg" />
          <Skeleton className="h-20" rounded="lg" />
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            title="No speakers yet"
            description="Speakers appear here once a meeting has a transcript."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Speakers" description="Everyone Click has heard across your meetings." />
          <ul className="divide-y divide-border">
            {visible.map((speaker) => (
              <li key={speaker.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text">{speaker.name ?? "Unnamed speaker"}</p>
                    {speaker.isMe ? <Badge tone="accent">You</Badge> : null}
                    {speaker.mergedIntoId ? <Badge tone="neutral">Merged</Badge> : null}
                  </div>
                  {speaker.email ? (
                    <p className="text-xs text-text-muted">{speaker.email}</p>
                  ) : null}
                  <p className="text-xs text-text-muted">
                    {speaker.meetingCount} meeting{speaker.meetingCount === 1 ? "" : "s"} ·{" "}
                    {speaker.segmentCount} segment{speaker.segmentCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditing(speaker);
                      setName(speaker.name ?? "");
                      setFormError(null);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={visible.length < 2}
                    onClick={() => {
                      setMergeSource(speaker);
                      setMergeTarget("");
                    }}
                  >
                    Merge into…
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Rename speaker">
        <div className="grid gap-3">
          <Field label="Name" htmlFor="speaker-name" error={formError ?? undefined}>
            <Input
              id="speaker-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => void saveName()}>
            Save
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={mergeSource !== null}
        onClose={() => setMergeSource(null)}
        title="Merge speakers"
        description={
          mergeSource
            ? `All segments from “${mergeSource.name ?? "Unnamed"}” move to the chosen speaker.`
            : undefined
        }
      >
        <div className="grid gap-3">
          <Field label="Merge into" htmlFor="merge-target">
            <select
              id="merge-target"
              value={mergeTarget}
              onChange={(event) => setMergeTarget(event.target.value)}
              className="h-10 w-full rounded-md border border-border-input bg-surface px-3 text-base text-text"
            >
              <option value="">Choose a speaker</option>
              {visible
                .filter((speaker) => speaker.id !== mergeSource?.id)
                .map((speaker) => (
                  <option key={speaker.id} value={speaker.id}>
                    {speaker.name ?? "Unnamed speaker"}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMergeSource(null)}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} disabled={!mergeTarget} onClick={() => void doMerge()}>
            Merge
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
