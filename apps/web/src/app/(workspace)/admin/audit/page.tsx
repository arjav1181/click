"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  fetchAuditEvents,
  fetchMembers,
  type AuditEventRow,
  type WorkspaceMemberRow,
} from "@/lib/api";

const PAGE_SIZE = 25;

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function describeAction(action: string) {
  const [subject, verb] = action.split(".");
  const readable = (word: string) => word.replace(/_/g, " ");
  return `${readable(subject ?? action)} ${readable(verb ?? "")}`.trim();
}

function actionTone(action: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (action.includes("deleted") || action.includes("revoked")) return "danger";
  if (action.includes("created") || action.includes("updated")) return "success";
  if (action.includes("invited") || action.includes("exported")) return "warning";
  return "neutral";
}

function toCsv(events: AuditEventRow[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ["Time", "Actor", "Action", "Target type", "Target", "IP"];
  const rows = events.map((event) =>
    [
      event.createdAt,
      event.actorName ?? "system",
      event.action,
      event.targetType ?? "",
      event.targetId ?? "",
      event.ip ?? "",
    ]
      .map((cell) => escape(cell))
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export default function AdminAuditPage() {
  const toast = useToast();
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [targetType, setTargetType] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);

  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<AuditEventRow | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    fetchAuditEvents({
      action: action || undefined,
      actorId: actorId || undefined,
      targetType: targetType || undefined,
      since: since ? new Date(since).toISOString() : undefined,
      until: until ? new Date(`${until}T23:59:59`).toISOString() : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }).then((result) => {
      if (result.data) {
        setEvents(result.data.events);
        setActions(result.data.actions);
        setLoading(false);
        return;
      }
      setError(result.error);
      if (result.status === 403) setForbidden(true);
      setLoading(false);
    });
  };

  useEffect(load, [action, actorId, targetType, since, until, page]);

  useEffect(() => {
    fetchMembers().then((result) => {
      if (result.data) setMembers(result.data.members);
    });
  }, []);

  const targetTypes = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) if (event.targetType) set.add(event.targetType);
    return Array.from(set).sort();
  }, [events]);

  const hasFilters = Boolean(action || actorId || targetType || since || until);

  const exportCsv = async () => {
    setExporting(true);
    // Export the whole filtered result, not just the visible page.
    const result = await fetchAuditEvents({
      action: action || undefined,
      actorId: actorId || undefined,
      targetType: targetType || undefined,
      since: since ? new Date(since).toISOString() : undefined,
      until: until ? new Date(`${until}T23:59:59`).toISOString() : undefined,
      limit: 200,
    });
    setExporting(false);
    if (result.error || !result.data) {
      toast.push({
        tone: "error",
        title: "Export failed",
        description: result.error ?? "We could not prepare the file.",
      });
      return;
    }
    const blob = new Blob([toCsv(result.data.events)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "click-audit-log.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.push({
      tone: "success",
      title: "Audit log exported",
      description: `${result.data.events.length} events written to CSV.`,
    });
  };

  const clearFilters = () => {
    setAction("");
    setActorId("");
    setTargetType("");
    setSince("");
    setUntil("");
    setPage(1);
  };

  if (forbidden) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Admin access required"
            description="Only owners and admins can read the audit log."
            action={
              <Button variant="secondary" size="sm" onClick={() => window.history.back()}>
                Go back
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Audit log</h2>
          <p className="text-sm text-text-muted">Every privileged action in this workspace.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportCsv}
          loading={exporting}
          disabled={events.length === 0}
        >
          {exporting ? "Preparing export…" : "Export CSV"}
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="The audit log could not be loaded"
          action={
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="audit-action">
              Action
            </label>
            <Select
              id="audit-action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All actions</option>
              {actions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="audit-actor">
              Actor
            </label>
            <Select
              id="audit-actor"
              value={actorId}
              onChange={(event) => {
                setActorId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Anyone</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="audit-target">
              Target
            </label>
            <Select
              id="audit-target"
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All targets</option>
              {targetTypes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="audit-since">
                From
              </label>
              <Input
                id="audit-since"
                type="date"
                value={since}
                onChange={(event) => {
                  setSince(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="audit-until">
                To
              </label>
              <Input
                id="audit-until"
                type="date"
                value={until}
                onChange={(event) => {
                  setUntil(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
        {hasFilters ? (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12" rounded="lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <EmptyState
            title={hasFilters ? "No events match" : "No activity yet"}
            description={
              hasFilters
                ? "Nothing was recorded for this combination of filters."
                : "Admin actions, exports and access changes show up here as they happen."
            }
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[10rem_10rem_1fr_8rem_7rem] gap-3 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted md:grid">
            <span>When</span>
            <span>Actor</span>
            <span>Action</span>
            <span>Target</span>
            <span className="text-right">Details</span>
          </div>
          <div className="divide-y divide-border">
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setDetail(event)}
                className="grid w-full grid-cols-1 gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 md:grid-cols-[10rem_10rem_1fr_8rem_7rem] md:items-center md:gap-3"
              >
                <span className="text-xs text-text-muted">
                  <span className="md:hidden">{formatTimestamp(event.createdAt)} · </span>
                  <span className="hidden md:inline">{formatTimestamp(event.createdAt)}</span>
                  <span className="text-text-muted/70 md:hidden">({relativeTime(event.createdAt)})</span>
                </span>
                <span className="truncate text-sm text-text">{event.actorName ?? "System"}</span>
                <span className="min-w-0">
                  <Badge tone={actionTone(event.action)}>{event.action}</Badge>
                </span>
                <span className="truncate text-xs text-text-muted">
                  {event.targetType ?? "—"}
                </span>
                <span className="text-xs font-semibold text-accent md:text-right">View</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {events.length > 0 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
          <span>
            Page {page} · showing {events.length} event{events.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={events.length < PAGE_SIZE || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Audit event"
        description={detail ? describeAction(detail.action) : undefined}
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Close
          </Button>
        }
      >
        {detail ? (
          <dl className="grid gap-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted">Action</dt>
              <dd>
                <Badge tone={actionTone(detail.action)}>{detail.action}</Badge>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted">Actor</dt>
              <dd className="truncate text-text">{detail.actorName ?? "System"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted">When</dt>
              <dd className="text-text">{formatTimestamp(detail.createdAt)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted">Target</dt>
              <dd className="truncate text-text">
                {detail.targetType ?? "—"}
                {detail.targetId ? (
                  <span className="ml-2 text-xs text-text-muted">{detail.targetId}</span>
                ) : null}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted">IP address</dt>
              <dd className="text-text">{detail.ip ?? "—"}</dd>
            </div>
            {detail.metadata && Object.keys(detail.metadata).length > 0 ? (
              <div>
                <dt className="mb-1 text-text-muted">Details</dt>
                <dd>
                  <pre className="mono max-h-48 overflow-auto rounded-md border border-border bg-surface-2 p-3 text-xs text-text">
                    {JSON.stringify(detail.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Dialog>
    </div>
  );
}
