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
  connectCalendar,
  disconnectCalendar,
  fetchCalendars,
  type CalendarConnectionRow,
} from "@/lib/api";

export default function CalendarsPage() {
  const toast = useToast();
  const [connections, setConnections] = useState<CalendarConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [provider, setProvider] = useState<"google" | "microsoft">("google");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCalendars();
    if (result.data) setConnections(result.data.connections);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    if (!email.trim()) {
      setFormError("Enter an account email.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const result = await connectCalendar({ provider, accountEmail: email.trim() });
    setSaving(false);
    if (result.error || !result.data) {
      setFormError(result.error ?? "That connection could not be created.");
      return;
    }
    setDialog(false);
    setEmail("");
    toast.push({ tone: "success", title: "Calendar connected" });
    await load();
  };

  const disconnect = async (connection: CalendarConnectionRow) => {
    if (!window.confirm(`Disconnect ${connection.accountEmail}?`)) return;
    const result = await disconnectCalendar(connection.id);
    if (result.error) {
      toast.push({ tone: "error", title: "Could not disconnect", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Calendar disconnected" });
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Calendars</h2>
          <p className="text-sm text-text-muted">
            Connect Google or Microsoft Calendar to auto-join meetings.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog(true)}>
          Connect calendar
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Calendars could not be loaded"
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
      ) : connections.length === 0 ? (
        <Card>
          <EmptyState
            title="No calendars connected"
            description="Connect a calendar to auto-join meetings and see upcoming events."
            action={
              <Button size="sm" onClick={() => setDialog(true)}>
                Connect calendar
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Connected calendars" />
          <ul className="divide-y divide-border">
            {connections.map((connection) => (
              <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text">{connection.accountEmail}</p>
                    <Badge tone={connection.status === "connected" ? "success" : "danger"}>
                      {connection.status}
                    </Badge>
                    <Badge tone="neutral">{connection.provider}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Connected {new Date(connection.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => void disconnect(connection)}>
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Connect a calendar">
        <div className="grid gap-3">
          <Field label="Provider" htmlFor="calendar-provider">
            <select
              id="calendar-provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value as typeof provider)}
              className="h-10 w-full rounded-md border border-border-input bg-surface px-3 text-base text-text"
            >
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
          </Field>
          <Field label="Account email" htmlFor="calendar-email">
            <Input
              id="calendar-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          {formError ? <p className="text-xs text-danger">{formError}</p> : null}
          <p className="text-xs text-text-muted">
            In production this opens an OAuth consent screen. This build stores the connection locally.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDialog(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => void connect()}>
            Connect
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
