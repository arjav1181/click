"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Skeleton,
  useToast,
} from "@click/ui";
import { fetchPublicRecap, type PublicRecap } from "@/lib/api";

export default function PublicRecapPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<PublicRecap | null>(null);

  const load = async (pwd?: string) => {
    setLoading(true);
    setError(null);
    setPasswordError(null);
    const result = await fetchPublicRecap(token, pwd);
    setLoading(false);
    if (result.data) {
      setRecap(result.data);
      setNeedsPassword(false);
      return;
    }
    const status = result.status;
    if (status === 401) {
      setNeedsPassword(true);
      return;
    }
    if (status === 403) {
      setNeedsPassword(true);
      setPasswordError(result.error ?? "That password is not correct.");
      return;
    }
    setError(result.error ?? "This link is not available.");
  };

  useEffect(() => {
    void load();
  }, [token]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="mb-4 h-4 w-80" />
        <Skeleton className="h-64" rounded="lg" />
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader
            title="Password-protected recap"
            description="Enter the password to view this meeting."
          />
          <div className="grid gap-3 p-4">
            <Field label="Password" htmlFor="recap-password" error={passwordError ?? undefined}>
              <Input
                id="recap-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button size="sm" onClick={() => void load(password)}>
              Unlock
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !recap) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="This recap is not available"
            description={error ?? "The link may have expired or been revoked."}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <Badge tone="accent">Shared recap</Badge>
        <h1 className="mt-2 text-2xl font-semibold text-text">{recap.meeting.title}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {recap.meeting.startedAt
            ? new Date(recap.meeting.startedAt).toLocaleString()
            : "No date"}{" "}
          · {Math.round(recap.meeting.durationSeconds / 60)} min · hosted by {recap.meeting.ownerName}
        </p>
      </div>

      {recap.note?.sections.length ? (
        <Card className="mb-4">
          <CardHeader title="Notes" />
          <div className="grid gap-4 p-4">
            {recap.note.sections.map((section) => (
              <section key={section.id}>
                <h3 className="text-base font-semibold text-text">{section.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">{section.body}</p>
              </section>
            ))}
          </div>
        </Card>
      ) : recap.note?.rawMarkdown ? (
        <Card className="mb-4">
          <CardHeader title="Notes" />
          <div className="p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-text">{recap.note.rawMarkdown}</p>
          </div>
        </Card>
      ) : null}

      {recap.transcript.length > 0 ? (
        <Card>
          <CardHeader title="Transcript" />
          <div className="grid gap-1 p-4">
            {recap.transcript.map((segment) => {
              const seconds = Math.floor(segment.startMs / 1000);
              const stamp = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
                seconds % 60,
              ).padStart(2, "0")}`;
              return (
                <div key={segment.id} className="flex gap-3 text-sm">
                  <span className="mono w-12 shrink-0 text-xs text-text-muted">{stamp}</span>
                  <div className="min-w-0">
                    <span className="font-semibold text-text">{segment.speakerName ?? "Speaker"}: </span>
                    <span className="text-text">{segment.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {recap.note?.sections.length === 0 && !recap.note?.rawMarkdown && recap.transcript.length === 0 ? (
        <Card>
          <EmptyState title="No content yet" description="This meeting has no notes or transcript to share." />
        </Card>
      ) : null}
    </div>
  );
}
