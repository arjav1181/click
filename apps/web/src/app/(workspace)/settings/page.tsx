"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
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
import { fetchProfile, updateProfile, type ProfileDto } from "@/lib/api";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-IN", label: "English (India)" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" },
  { value: "pt-BR", label: "Português (Brasil)" },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Europe/Madrid", label: "Madrid (CET)" },
  { value: "Asia/Kolkata", label: "Kolkata (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const RELATED = [
  {
    href: "/settings/speakers",
    label: "Speaker management",
    description: "Merge, rename and label the people who speak in your meetings.",
    screen: "S48",
  },
  {
    href: "/settings/vocabulary",
    label: "Vocabulary",
    description: "Teach the transcriber the names and terms your team uses.",
    screen: "S49",
  },
  {
    href: "/settings/notifications",
    label: "Notifications",
    description: "Choose which email and in-app notifications you receive.",
    screen: "S52",
  },
  {
    href: "/settings/privacy",
    label: "Consent & privacy",
    description: "Set the recording notice and consent message for participants.",
    screen: "S50",
  },
  {
    href: "/settings/retention",
    label: "Retention",
    description: "Choose how long recordings, transcripts and notes are kept.",
    screen: "S51",
  },
  {
    href: "/settings/calendars",
    label: "Calendars",
    description: "Connect Google or Microsoft Calendar and pick auto-join rules.",
    screen: "S05",
  },
];

export default function PersonalSettingsPage() {
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [locale, setLocale] = useState("en");
  const [timezone, setTimezone] = useState("UTC");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchProfile();
    if (result.data) {
      setProfile(result.data);
      setName(result.data.user.name);
      setAvatarUrl(result.data.user.avatarUrl ?? "");
      setLocale(result.data.user.locale);
      setTimezone(result.data.user.timezone);
    }
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mark = () => setDirty(true);

  const changed = useMemo(() => {
    if (!profile) return false;
    return (
      name.trim() !== profile.user.name ||
      avatarUrl.trim() !== (profile.user.avatarUrl ?? "") ||
      locale !== profile.user.locale ||
      timezone !== profile.user.timezone
    );
  }, [profile, name, avatarUrl, locale, timezone]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFieldError("Your name cannot be empty.");
      return;
    }
    setFieldError(null);
    setSaving(true);
    const result = await updateProfile({
      name: name.trim(),
      locale,
      timezone,
      avatarUrl: avatarUrl.trim() || null,
    });
    setSaving(false);
    if (result.error) {
      setFieldError(result.error);
      toast.push({ tone: "error", title: "Settings did not save", description: result.error });
      return;
    }
    if (result.data) {
      setProfile(result.data);
      setName(result.data.user.name);
      setAvatarUrl(result.data.user.avatarUrl ?? "");
    }
    setDirty(false);
    toast.push({ tone: "success", title: "Personal settings saved" });
  };

  if (error && !profile) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Settings could not be loaded"
            description={error}
            action={
              <Button size="sm" onClick={load}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Personal settings</h2>
        <p className="text-sm text-text-muted">
          Your profile, language and time zone. Only you can see these.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Some settings could not be loaded"
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
        <div className="grid gap-4">
          <Skeleton className="h-56" rounded="lg" />
          <Skeleton className="h-64" rounded="lg" />
          <Skeleton className="h-48" rounded="lg" />
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={save}>
          <Card>
            <CardHeader title="Profile" description="How your name appears to everyone else." />
            <div className="grid gap-4 p-4">
              <div className="flex items-center gap-4">
                <Avatar name={name || profile?.user.name || "?"} src={avatarUrl.trim() || undefined} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{profile?.user.email}</p>
                  <p className="text-xs text-text-muted">
                    {profile?.user.emailVerified ? (
                      <Badge tone="success">Verified</Badge>
                    ) : (
                      <Badge tone="warning">Email not verified</Badge>
                    )}
                  </p>
                </div>
              </div>
              <Field label="Display name" htmlFor="profile-name" error={fieldError ?? undefined}>
                <Input
                  id="profile-name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => {
                    setName(event.target.value);
                    mark();
                  }}
                  invalid={Boolean(fieldError)}
                />
              </Field>
              <Field
                label="Avatar URL"
                htmlFor="profile-avatar"
                hint="Paste a link to an image. Leave blank to use your initials."
              >
                <Input
                  id="profile-avatar"
                  type="url"
                  value={avatarUrl}
                  maxLength={2000}
                  placeholder="https://example.com/avatar.png"
                  onChange={(event) => {
                    setAvatarUrl(event.target.value);
                    mark();
                  }}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Language & region" description="Used for dates, times and summaries." />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Interface language" htmlFor="profile-locale">
                <Select
                  id="profile-locale"
                  value={locale}
                  onChange={(event) => {
                    setLocale(event.target.value);
                    mark();
                  }}
                >
                  {LOCALES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Time zone" htmlFor="profile-timezone">
                <Select
                  id="profile-timezone"
                  value={timezone}
                  onChange={(event) => {
                    setTimezone(event.target.value);
                    mark();
                  }}
                >
                  {TIMEZONES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="text-xs text-text-muted sm:col-span-2">
                Meeting times and notification digests use this time zone. Transcription language is set per
                meeting.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="More settings" description="Everything else lives in its own place." />
            <div className="divide-y divide-border">
              {RELATED.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 p-4 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.description}</p>
                  </div>
                  <span className="text-xs text-text-muted">{item.screen}</span>
                  <span aria-hidden className="text-text-muted">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-pop">
            <p className="text-xs text-text-muted">
              {changed ? "You have unsaved changes." : "Everything is saved."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || !changed}
                onClick={() => {
                  void load();
                  setDirty(false);
                }}
              >
                Discard
              </Button>
              <Button type="submit" size="sm" loading={saving} disabled={!changed && !dirty}>
                Save changes
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
