"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  createCalendarRule,
  deleteCalendarRule,
  disconnectCalendar,
  fetchCalendarEvents,
  fetchCalendarProviders,
  fetchCalendars,
  setEventAutoJoin,
  syncCalendar,
  updateCalendar,
  type CalendarConnectionRow,
  type CalendarEventRow,
  type CalendarProviderStatus,
  type CalendarRuleRow,
} from "@/lib/api";

export default function CalendarsPage() {
  const toast = useToast();
  const [connections, setConnections] = useState<CalendarConnectionRow[]>([]);
  const [providers, setProviders] = useState<CalendarProviderStatus[]>([]);
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [rules, setRules] = useState<CalendarRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [provider, setProvider] = useState<"google" | "microsoft">("google");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleHost, setRuleHost] = useState("");
  const [ruleAttendee, setRuleAttendee] = useState("");
  const [ruleAutoJoin, setRuleAutoJoin] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [calendarResult, providerResult, eventResult] = await Promise.all([
      fetchCalendars(),
      fetchCalendarProviders(),
      fetchCalendarEvents(),
    ]);
    if (calendarResult.data) setConnections(calendarResult.data.connections);
    if (providerResult.data) setProviders(providerResult.data.providers);
    if (eventResult.data) {
      setEvents(eventResult.data.events);
      setRules(eventResult.data.rules);
    }
    const message = calendarResult.error ?? providerResult.error ?? eventResult.error;
    if (message) setError(message);
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
    toast.push({
      tone: "success",
      title: "Calendar connected",
      description: "Sync it to pull in your meetings.",
    });
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

  const toggleConnection = async (connection: CalendarConnectionRow, autoJoin: boolean) => {
    setBusyId(connection.id);
    const result = await updateCalendar(connection.id, { autoJoin });
    setBusyId(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Could not save", description: result.error });
      return;
    }
    await load();
  };

  const runSync = async (connection: CalendarConnectionRow) => {
    setBusyId(connection.id);
    const result = await syncCalendar(connection.id);
    setBusyId(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Sync failed", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Sync queued", description: "Events refresh in the background." });
    await load();
  };

  const toggleEvent = async (event: CalendarEventRow, autoJoin: boolean | null) => {
    setBusyId(event.id);
    const result = await setEventAutoJoin(event.id, autoJoin);
    setBusyId(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Could not save", description: result.error });
      return;
    }
    await load();
  };

  const addRule = async () => {
    setSaving(true);
    const result = await createCalendarRule({
      titlePattern: ruleTitle.trim() || null,
      hostPattern: ruleHost.trim() || null,
      attendeeEmail: ruleAttendee.trim() || null,
      autoJoin: ruleAutoJoin,
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setRuleOpen(false);
    setRuleTitle("");
    setRuleHost("");
    setRuleAttendee("");
    toast.push({ tone: "success", title: "Rule added" });
    await load();
  };

  const removeRule = async (rule: CalendarRuleRow) => {
    const result = await deleteCalendarRule(rule.id);
    if (result.error) {
      toast.push({ tone: "error", title: "Could not delete", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Rule removed" });
    await load();
  };

  const oauthNotice = providers.find((item) => !item.configured);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Calendars</h2>
          <p className="text-sm text-text-muted">
            Connect Google or Microsoft Calendar to auto-join meetings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDialog(true)}>
            Connect manually
          </Button>
          {providers
            .filter((item) => item.configured)
            .map((item) => (
              <a key={item.provider} href={item.connectUrl}>
                <Button size="sm">Connect {item.provider === "google" ? "Google" : "Microsoft"}</Button>
              </a>
            ))}
        </div>
      </div>

      {oauthNotice ? (
        <Banner tone="info" title="OAuth is not configured on this instance" className="mb-4">
          Set {oauthNotice.provider === "google" ? "GOOGLE_CLIENT_ID" : "MICROSOFT_CLIENT_ID"} and its secret to
          enable the consent screen. Until then you can add a calendar manually.
        </Banner>
      ) : null}

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
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Connected calendars" description="Auto-join applies to every meeting on these calendars." />
            {connections.length === 0 ? (
              <EmptyState
                title="No calendars connected"
                description="Connect a calendar to auto-join meetings and see upcoming events."
              />
            ) : (
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
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-text-muted">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--color-accent)]"
                          checked={connection.autoJoin}
                          disabled={busyId === connection.id}
                          onChange={(event) => void toggleConnection(connection, event.target.checked)}
                        />
                        Auto-join
                      </label>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busyId === connection.id}
                        onClick={() => void runSync(connection)}
                      >
                        Sync now
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => void disconnect(connection)}>
                        Disconnect
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Auto-join rules"
              description="Rules are checked in order. The first match decides whether a bot joins."
              actions={
                <Button variant="secondary" size="sm" onClick={() => setRuleOpen(true)}>
                  Add rule
                </Button>
              }
            />
            {rules.length === 0 ? (
              <EmptyState
                title="No rules yet"
                description="Without a rule, each calendar follows its own auto-join switch."
              />
            ) : (
              <ul className="divide-y divide-border">
                {rules.map((rule) => (
                  <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-text">
                        {rule.titlePattern ? `Title contains “${rule.titlePattern}”` : "Any meeting"}
                        {rule.hostPattern ? ` · host ${rule.hostPattern}` : ""}
                        {rule.attendeeEmail ? ` · attendee ${rule.attendeeEmail}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {rule.autoJoin ? "Send a bot" : "Do not send a bot"} · priority {rule.priority}
                      </p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => void removeRule(rule)}>
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Upcoming events" description="Synced meetings. Toggle the bot per meeting." />
            {events.length === 0 ? (
              <EmptyState
                title="No events synced"
                description="Connect a calendar and run a sync to see your meetings here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {events.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{event.title ?? "Untitled meeting"}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {new Date(event.startsAt).toLocaleString()} ·{" "}
                        {event.botStatus !== "none" ? `bot ${event.botStatus}` : "no bot"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/app/briefs/${event.id}`}>
                        <Button variant="secondary" size="sm">
                          Brief
                        </Button>
                      </Link>
                      <label className="flex items-center gap-2 text-xs text-text-muted">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--color-accent)]"
                          checked={event.autoJoin ?? false}
                          disabled={busyId === event.id}
                          onChange={(input) => void toggleEvent(event, input.target.checked)}
                        />
                        Bot
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Connect a calendar manually">
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
            Manual connections do not sync events. Use the OAuth button to pull meetings in.
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

      <Dialog
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        title="Add an auto-join rule"
        description="Leave a field empty to match anything."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRuleOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={() => void addRule()}>
              Add rule
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Title contains" htmlFor="rule-title">
            <Input
              id="rule-title"
              value={ruleTitle}
              placeholder="standup"
              onChange={(event) => setRuleTitle(event.target.value)}
            />
          </Field>
          <Field label="Meeting host contains" htmlFor="rule-host">
            <Input
              id="rule-host"
              value={ruleHost}
              placeholder="zoom.us"
              onChange={(event) => setRuleHost(event.target.value)}
            />
          </Field>
          <Field label="Attendee email" htmlFor="rule-attendee">
            <Input
              id="rule-attendee"
              type="email"
              value={ruleAttendee}
              placeholder="lead@example.com"
              onChange={(event) => setRuleAttendee(event.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={ruleAutoJoin}
              onChange={(event) => setRuleAutoJoin(event.target.checked)}
            />
            Send a bot when this rule matches
          </label>
        </div>
      </Dialog>
    </div>
  );
}
