"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import { fetchRetention, updateRetention, type RetentionPolicy } from "@/lib/api";

const TRANSCRIPT_OPTIONS = [
  { value: "", label: "Keep forever" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
  { value: "730", label: "2 years" },
];

const AUDIO_OPTIONS = [
  { value: "", label: "Keep forever" },
  { value: "0", label: "Delete immediately" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export default function RetentionPage() {
  const toast = useToast();
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [transcriptDays, setTranscriptDays] = useState<string>("");
  const [audioDays, setAudioDays] = useState<string>("");
  const [recordingMode, setRecordingMode] = useState<RetentionPolicy["recordingMode"]>("audio");
  const [legalHold, setLegalHold] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchRetention();
    if (result.data) {
      setPolicy(result.data.policy);
      setTranscriptDays(result.data.policy.transcriptDays?.toString() ?? "");
      setAudioDays(result.data.policy.audioDays?.toString() ?? "");
      setRecordingMode(result.data.policy.recordingMode);
      setLegalHold(result.data.policy.legalHoldOverride);
    }
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setFormError(null);
    setSaving(true);
    const result = await updateRetention({
      transcriptDays: transcriptDays === "" ? null : Number(transcriptDays),
      audioDays: audioDays === "" ? null : Number(audioDays),
      recordingMode,
      legalHoldOverride: legalHold,
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      toast.push({ tone: "error", title: "Retention policy did not save", description: result.error });
      return;
    }
    if (result.data) {
      setPolicy(result.data.policy);
      toast.push({ tone: "success", title: "Retention policy saved" });
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Retention</h2>
        <p className="text-sm text-text-muted">
          How long recordings, transcripts and notes are kept. Only workspace owners and admins can change
          this.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Retention policy could not be loaded"
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
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Recording mode" description="What Click captures for every meeting." />
            <div className="grid gap-4 p-4">
              <Field label="Capture" htmlFor="retention-mode">
                <Select
                  id="retention-mode"
                  value={recordingMode}
                  onChange={(event) => setRecordingMode(event.target.value as RetentionPolicy["recordingMode"])}
                >
                  <option value="audio">Audio only</option>
                  <option value="audio_video">Audio and video</option>
                  <option value="transcript_only">Transcript only (no audio stored)</option>
                </Select>
              </Field>
              <p className="text-xs text-text-muted">
                Transcript-only mode stores no recording at all, so exports and playback of audio are
                unavailable.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Auto-delete" description="Older data is removed automatically." />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Transcripts and notes" htmlFor="retention-transcripts">
                <Select
                  id="retention-transcripts"
                  value={transcriptDays}
                  onChange={(event) => setTranscriptDays(event.target.value)}
                >
                  {TRANSCRIPT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Audio and video" htmlFor="retention-audio">
                <Select
                  id="retention-audio"
                  value={audioDays}
                  onChange={(event) => setAudioDays(event.target.value)}
                >
                  {AUDIO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Legal hold" description="Pause automatic deletion for compliance." />
            <label className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--color-accent)]"
                checked={legalHold}
                onChange={(event) => setLegalHold(event.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Legal hold override</span>
                <span className="block text-xs text-text-muted">
                  When on, retention rules are suspended until the hold is released.
                </span>
              </span>
            </label>
          </Card>

          {formError ? <p className="text-xs text-danger">{formError}</p> : null}

          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">
              {policy?.updatedAt ? `Last updated ${new Date(policy.updatedAt).toLocaleString()}` : "Never saved"}
            </p>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save policy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
