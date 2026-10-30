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
  Skeleton,
  Textarea,
  useToast,
} from "@click/ui";
import {
  fetchRecordingPolicy,
  updateRecordingPolicy,
  type RecordingPolicy,
} from "@/lib/api";

export default function RecordingPolicyPage() {
  const toast = useToast();
  const [policy, setPolicy] = useState<RecordingPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [autoJoin, setAutoJoin] = useState(false);
  const [botName, setBotName] = useState("Click bot");
  const [consentNotice, setConsentNotice] = useState("");
  const [privateByDefault, setPrivateByDefault] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchRecordingPolicy();
    if (result.data) {
      setPolicy(result.data.policy);
      setAutoJoin(result.data.policy.autoJoinDefault);
      setBotName(result.data.policy.botName);
      setConsentNotice(result.data.policy.consentNotice);
      setPrivateByDefault(result.data.policy.privateByDefault);
    }
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!botName.trim() || !consentNotice.trim()) {
      setFormError("Bot name and consent notice cannot be empty.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const result = await updateRecordingPolicy({
      autoJoinDefault: autoJoin,
      botName: botName.trim(),
      consentNotice: consentNotice.trim(),
      privateByDefault,
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      toast.push({ tone: "error", title: "Recording policy did not save", description: result.error });
      return;
    }
    if (result.data) {
      setPolicy(result.data.policy);
      toast.push({ tone: "success", title: "Recording policy saved" });
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Recording & privacy</h2>
        <p className="text-sm text-text-muted">
          Workspace-wide capture policy: when a bot joins, what it calls itself, and what participants are
          told.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Recording policy could not be loaded"
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
            <CardHeader title="Auto-join" description="When a bot joins a meeting on its own." />
            <label className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--color-accent)]"
                checked={autoJoin}
                onChange={(event) => setAutoJoin(event.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Auto-join calendar meetings</span>
                <span className="block text-xs text-text-muted">
                  Bots join meetings that match your auto-join rules without a manual request.
                </span>
              </span>
            </label>
          </Card>

          <Card>
            <CardHeader title="Bot identity" description="How the bot appears in the meeting." />
            <div className="grid gap-4 p-4">
              <Field label="Bot display name" htmlFor="recording-bot-name">
                <Input
                  id="recording-bot-name"
                  value={botName}
                  maxLength={80}
                  onChange={(event) => setBotName(event.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Consent notice" description="Posted in the meeting chat when recording starts." />
            <div className="grid gap-4 p-4">
              <Field label="Notice text" htmlFor="recording-consent">
                <Textarea
                  id="recording-consent"
                  rows={4}
                  value={consentNotice}
                  maxLength={2000}
                  onChange={(event) => setConsentNotice(event.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Visibility" description="Default visibility for new meetings." />
            <label className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--color-accent)]"
                checked={privateByDefault}
                onChange={(event) => setPrivateByDefault(event.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Private by default</span>
                <span className="block text-xs text-text-muted">
                  New meetings are visible only to the host unless changed.
                </span>
              </span>
            </label>
          </Card>

          {formError ? <p className="text-xs text-danger">{formError}</p> : null}

          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">
              {policy ? "Saved" : "Not saved yet"}
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
