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
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import { getMeeting } from "@/lib/api";

const PROVIDERS = [
  { value: "zoom", label: "Zoom", host: "zoom.us" },
  { value: "teams", label: "Microsoft Teams", host: "teams.microsoft.com" },
  { value: "meet", label: "Google Meet", host: "meet.google.com" },
  { value: "webex", label: "Webex", host: "webex.com" },
  { value: "jitsi", label: "Jitsi", host: "meet.jit.si" },
];

export default function BotPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const [meetingTitle, setMeetingTitle] = useState<string>("");
  const [provider, setProvider] = useState("zoom");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    getMeeting(id).then((m) => {
      if (m) setMeetingTitle(m.title);
    });
  }, [id]);

  const send = async () => {
    setError(null);
    setResult(null);
    setSending(true);
    try {
      const response = await fetch(`/api/v1/meetings/${id}/bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, meetingUrl: url.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { bot?: { id: string; state: string }; error?: { message?: string } };
      if (!response.ok) {
        setError(payload.error?.message ?? "The bot could not be queued.");
      } else {
        setResult(`Bot queued (${payload.bot?.state ?? "queued"}).`);
        toast.push({ tone: "success", title: "Bot queued" });
      }
    } catch {
      setError("We could not reach the server.");
    }
    setSending(false);
  };

  const cancel = async () => {
    try {
      const response = await fetch(`/api/v1/meetings/${id}/bot`, { method: "DELETE" });
      if (response.ok) {
        setResult("Bot cancelled.");
        toast.push({ tone: "success", title: "Bot cancelled" });
      } else {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(payload.error?.message ?? "No active bot to cancel.");
      }
    } catch {
      setError("We could not reach the server.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Send bot</h2>
        <p className="text-sm text-text-muted">
          {meetingTitle ? `Meeting: ${meetingTitle}` : "Send a bot to join a meeting link."}
        </p>
      </div>

      {error ? (
        <Banner tone="danger" title="Bot could not be queued" className="mb-4">
          {error}
        </Banner>
      ) : null}
      {result ? (
        <Banner tone="success" title="Bot status" className="mb-4">
          {result}
        </Banner>
      ) : null}

      <Card>
        <CardHeader title="Bot settings" description="Pick a provider and paste the meeting link." />
        <div className="grid gap-4 p-4">
          <Field label="Provider" htmlFor="bot-provider">
            <Select id="bot-provider" value={provider} onChange={(event) => setProvider(event.target.value)}>
              {PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Meeting link"
            htmlFor="bot-url"
            hint={`Must be a ${PROVIDERS.find((p) => p.value === provider)?.host} link.`}
          >
            <Input
              id="bot-url"
              type="url"
              value={url}
              placeholder="https://..."
              onChange={(event) => setUrl(event.target.value)}
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button size="sm" loading={sending} disabled={!url.trim()} onClick={() => void send()}>
              Send bot
            </Button>
            <Button variant="danger" size="sm" onClick={() => void cancel()}>
              Cancel bot
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
