"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  Button,
  Card,
  CardHeader,
  Field,
  Skeleton,
  Textarea,
  useToast,
} from "@click/ui";
import { fetchConsent, updateConsent, type ConsentPolicy } from "@/lib/api";

export default function PrivacyPage() {
  const toast = useToast();
  const [policy, setPolicy] = useState<ConsentPolicy | null>(null);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [recordingNotice, setRecordingNotice] = useState("");
  const [watermark, setWatermark] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [adminLocked, setAdminLocked] = useState(false);

  const isAdmin = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchConsent();
    if (result.data) {
      setPolicy(result.data.policy);
      setRole(result.data.role);
      setRecordingNotice(result.data.policy.recordingNotice);
      setWatermark(result.data.policy.watermark);
      setChatMessage(result.data.policy.chatMessage);
      setAdminLocked(result.data.policy.adminLocked);
    }
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = policy?.adminLocked === true && !isAdmin;

  const save = async () => {
    setFormError(null);
    setSaving(true);
    const result = await updateConsent({
      recordingNotice: recordingNotice.trim(),
      watermark,
      chatMessage: chatMessage.trim(),
      adminLocked,
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      toast.push({ tone: "error", title: "Privacy settings did not save", description: result.error });
      return;
    }
    if (result.data) {
      setPolicy(result.data.policy);
      toast.push({ tone: "success", title: "Privacy settings saved" });
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Consent & transparency</h2>
        <p className="text-sm text-text-muted">
          The recording notice, watermark and chat message participants see.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Privacy settings could not be loaded"
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

      {policy?.adminLocked ? (
        <Banner tone="warning" title="Locked by an admin" className="mb-4">
          These settings can only be changed by a workspace owner or admin.
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
            <CardHeader title="Recording notice" description="Shown to participants before recording." />
            <div className="grid gap-4 p-4">
              <Field label="Notice text" htmlFor="privacy-notice">
                <Textarea
                  id="privacy-notice"
                  rows={3}
                  value={recordingNotice}
                  maxLength={2000}
                  disabled={locked}
                  onChange={(event) => setRecordingNotice(event.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Watermark" description="Overlay a watermark on shared recordings." />
            <label className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--color-accent)]"
                checked={watermark}
                disabled={locked}
                onChange={(event) => setWatermark(event.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Show watermark</span>
                <span className="block text-xs text-text-muted">
                  Adds a small Click watermark to shared recordings.
                </span>
              </span>
            </label>
          </Card>

          <Card>
            <CardHeader title="Chat message" description="Posted in the meeting chat when recording starts." />
            <div className="grid gap-4 p-4">
              <Field label="Message" htmlFor="privacy-chat">
                <Textarea
                  id="privacy-chat"
                  rows={3}
                  value={chatMessage}
                  maxLength={2000}
                  disabled={locked}
                  onChange={(event) => setChatMessage(event.target.value)}
                />
              </Field>
            </div>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader title="Admin" description="Lock these settings so members cannot change them." />
              <label className="flex cursor-pointer items-start gap-3 p-4">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--color-accent)]"
                  checked={adminLocked}
                  onChange={(event) => setAdminLocked(event.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text">Lock settings</span>
                  <span className="block text-xs text-text-muted">
                    When on, only owners and admins can change these values.
                  </span>
                </span>
              </label>
            </Card>
          ) : null}

          {formError ? <p className="text-xs text-danger">{formError}</p> : null}

          <div className="flex justify-end">
            <Button size="sm" loading={saving} disabled={locked} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
