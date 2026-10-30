"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  Button,
  Card,
  CardHeader,
  Field,
  Skeleton,
  useToast,
} from "@click/ui";
import { fetchNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from "@/lib/api";

// Notification prefs live in the org settings blob under a "notifications" key.
// Stored as workspace-wide defaults; members read, admins write.

export default function NotificationsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [followUps, setFollowUps] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchNotificationPrefs();
    if (result.data) {
      setDigest(result.data.prefs.digest);
      setMentions(result.data.prefs.mentions);
      setFollowUps(result.data.prefs.followUps);
      setReminders(result.data.prefs.reminders);
      setQuietHours(result.data.prefs.quietHours);
    }
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const result = await updateNotificationPrefs({
      digest,
      mentions,
      followUps,
      reminders,
      quietHours,
    });
    setSaving(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Preferences did not save", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Notification preferences saved" });
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Notifications</h2>
        <p className="text-sm text-text-muted">
          Email and in-app notification preferences.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Preferences could not be loaded"
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
        </div>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Email notifications" />
            <div className="divide-y divide-border">
              {[
                { label: "Weekly digest", desc: "A summary of your meetings.", value: digest, set: setDigest },
                { label: "Mentions", desc: "When someone mentions you.", value: mentions, set: setMentions },
                { label: "Follow-ups", desc: "When a follow-up is assigned to you.", value: followUps, set: setFollowUps },
                { label: "Meeting reminders", desc: "Reminders before a meeting starts.", value: reminders, set: setReminders },
              ].map((item) => (
                <label key={item.label} className="flex cursor-pointer items-start gap-3 p-4">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--color-accent)]"
                    checked={item.value}
                    onChange={(event) => item.set(event.target.checked)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text">{item.label}</span>
                    <span className="block text-xs text-text-muted">{item.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Quiet hours" />
            <label className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--color-accent)]"
                checked={quietHours}
                onChange={(event) => setQuietHours(event.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Enable quiet hours</span>
                <span className="block text-xs text-text-muted">
                  Pause non-urgent notifications during quiet hours.
                </span>
              </span>
            </label>
          </Card>

          <div className="flex justify-end">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save preferences
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
