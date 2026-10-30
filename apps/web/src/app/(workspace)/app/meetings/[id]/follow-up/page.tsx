"use client";

import { useCallback, useEffect, useState } from "react";
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
  Textarea,
  useToast,
} from "@click/ui";
import {
  fetchFollowUp,
  sendFollowUp,
  updateFollowUp,
  type EmailDraftRow,
} from "@/lib/api";

export default function FollowUpPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const [draft, setDraft] = useState<EmailDraftRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toInput, setToInput] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchFollowUp(id);
    if (result.data) {
      setDraft(result.data.draft);
      setToInput(result.data.draft.toAddrs.join(", "));
      setSubject(result.data.draft.subject);
      setBody(result.data.draft.body);
    }
    if (result.error) setError(result.error);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const result = await updateFollowUp(id, {
      toAddrs: toInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      subject,
      body,
    });
    setSaving(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Draft did not save", description: result.error });
      return;
    }
    if (result.data) setDraft(result.data.draft);
  };

  const send = async () => {
    const recipients = toInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      toast.push({ tone: "error", title: "Add at least one recipient" });
      return;
    }
    setSending(true);
    const result = await sendFollowUp(id, recipients);
    setSending(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Email could not be sent", description: result.error });
      return;
    }
    if (result.data) {
      setDraft(result.data.draft);
      toast.push({ tone: "success", title: "Follow-up sent" });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="h-64" rounded="lg" />
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Follow-up could not be loaded"
            description={error ?? "Try again."}
            action={
              <Button size="sm" onClick={load}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const isSent = draft.status === "sent" || draft.status === "expired";

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xl font-semibold text-text">Follow-up composer</h2>
        {draft.status === "sent" ? <Badge tone="success">Sent</Badge> : null}
        {draft.status === "expired" ? <Badge tone="danger">Expired</Badge> : null}
      </div>
      <p className="mb-4 text-sm text-text-muted">
        Draft a recap email from this meeting. Sent through your configured SMTP.
      </p>

      {isSent ? (
        <Banner tone="info" title="This draft is no longer editable">
          Sent {draft.sentAt ? new Date(draft.sentAt).toLocaleString() : ""}.
        </Banner>
      ) : null}

      <Card className="mb-4">
        <CardHeader title="Recipients" />
        <div className="grid gap-4 p-4">
          <Field label="To" htmlFor="followup-to" hint="Comma-separated email addresses.">
            <Input
              id="followup-to"
              value={toInput}
              disabled={isSent}
              onChange={(event) => setToInput(event.target.value)}
            />
          </Field>
          <Field label="Subject" htmlFor="followup-subject">
            <Input
              id="followup-subject"
              value={subject}
              disabled={isSent}
              onChange={(event) => setSubject(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Body" />
        <div className="p-4">
          <Textarea
            value={body}
            rows={12}
            disabled={isSent}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {draft.expiresAt ? `Expires ${new Date(draft.expiresAt).toLocaleDateString()}` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" loading={saving} disabled={isSent} onClick={() => void save()}>
            Save draft
          </Button>
          <Button size="sm" loading={sending} disabled={isSent} onClick={() => void send()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
