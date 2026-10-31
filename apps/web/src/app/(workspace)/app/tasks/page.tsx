"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  createActionItem,
  fetchActionItems,
  fetchIntegrations,
  fetchMeetingOptions,
  patchActionItem,
  pushActionItem,
  type ActionItemRow,
} from "@/lib/api";
import { taskToolSpec, taskToolTarget } from "@/lib/taskTools";

type StatusFilter = "all" | "open" | "overdue" | "done";
type GroupBy = "meeting" | "due" | "assignee";

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function dueLabel(dueAt: string | null): { text: string; overdue: boolean; soon: boolean } {
  if (!dueAt) return { text: "No due date", overdue: false, soon: false };
  const due = new Date(dueAt);
  const today = startOfDay(new Date());
  const day = startOfDay(due);
  const diffDays = Math.round((day - today) / 86_400_000);
  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`, overdue: true, soon: false };
  }
  if (diffDays === 0) return { text: "Due today", overdue: false, soon: true };
  if (diffDays === 1) return { text: "Due tomorrow", overdue: false, soon: true };
  if (diffDays <= 7) return { text: `Due in ${diffDays} days`, overdue: false, soon: false };
  return {
    text: `Due ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    overdue: false,
    soon: false,
  };
}

function groupKey(item: ActionItemRow, groupBy: GroupBy): string {
  if (groupBy === "meeting") return item.meetingTitle;
  if (groupBy === "assignee") return item.assigneeName ?? "Unassigned";
  if (!item.dueAt) return "No due date";
  const due = new Date(item.dueAt);
  const today = startOfDay(new Date());
  const day = startOfDay(due);
  const diffDays = Math.round((day - today) / 86_400_000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return "This week";
  if (diffDays <= 30) return "This month";
  return "Later";
}

function toCsv(items: ActionItemRow[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ["Task", "Meeting", "Assignee", "Due", "Status"];
  const rows = items.map((item) =>
    [
      item.text,
      item.meetingTitle,
      item.assigneeName ?? "",
      item.dueAt ?? "",
      item.status,
    ]
      .map((cell) => escape(cell))
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export default function TasksPage() {
  const toast = useToast();
  const [items, setItems] = useState<ActionItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("meeting");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // New task
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskMeeting, setNewTaskMeeting] = useState("");
  const [meetings, setMeetings] = useState<Array<{ id: string; title: string }>>([]);
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [newTaskSaving, setNewTaskSaving] = useState(false);

  // Push to a project tool
  const [pushItem, setPushItem] = useState<ActionItemRow | null>(null);
  const [tools, setTools] = useState<
    Array<{ key: string; name: string; target: string; hasCredentials: boolean }>
  >([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushingTool, setPushingTool] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchActionItems()
      .then((result) => {
        if (result.data) {
          setItems(result.data.items);
          setLoading(false);
          return;
        }
        setError(result.error ?? "We could not load your tasks.");
        setLoading(false);
      });
  };

  useEffect(load, []);

  const openNewTask = async () => {
    setNewTaskError(null);
    setNewTaskOpen(true);
    const result = await fetchMeetingOptions();
    if (result.data) {
      setMeetings(result.data.meetings);
      setNewTaskMeeting((current) => current || result.data!.meetings[0]?.id || "");
    } else {
      setMeetings([]);
      setNewTaskError(result.error ?? "We could not load your meetings.");
    }
  };

  const createTask = async () => {
    if (!newTaskText.trim()) {
      setNewTaskError("Write what needs to be done.");
      return;
    }
    if (!newTaskMeeting) {
      setNewTaskError("Pick the meeting this task came from.");
      return;
    }
    setNewTaskError(null);
    setNewTaskSaving(true);
    const result = await createActionItem({
      meetingId: newTaskMeeting,
      text: newTaskText.trim(),
      assigneeName: newTaskAssignee.trim() || undefined,
      dueAt: newTaskDue ? new Date(`${newTaskDue}T12:00:00Z`).toISOString() : undefined,
    });
    setNewTaskSaving(false);
    if (result.error) {
      setNewTaskError(result.error);
      return;
    }
    setNewTaskOpen(false);
    setNewTaskText("");
    setNewTaskAssignee("");
    setNewTaskDue("");
    toast.push({ tone: "success", title: "Task created" });
    load();
  };

  const openPush = async (item: ActionItemRow) => {
    setPushItem(item);
    setPushError(null);
    setToolsLoading(true);
    const result = await fetchIntegrations();
    setToolsLoading(false);
    if (!result.data) {
      setTools([]);
      setPushError(result.error ?? "We could not load your integrations.");
      return;
    }
    setTools(
      result.data.connections
        .filter((connection) => connection.status === "connected")
        .map((connection) => {
          const spec = taskToolSpec(connection.integrationKey);
          if (!spec) return null;
          return {
            key: connection.integrationKey,
            name: spec.name,
            target: taskToolTarget(spec, connection.config),
            hasCredentials: connection.hasCredentials,
          };
        })
        .filter((tool): tool is { key: string; name: string; target: string; hasCredentials: boolean } =>
          tool !== null,
        ),
    );
  };

  const pushToTool = async (provider: string) => {
    if (!pushItem) return;
    setPushingTool(provider);
    setPushError(null);
    const result = await pushActionItem(pushItem.id, provider);
    setPushingTool(null);
    if (result.error || !result.data) {
      setPushError(result.error ?? "The task could not be pushed.");
      return;
    }
    const ref = result.data.ref;
    setItems((current) =>
      current.map((row) =>
        row.id === pushItem.id
          ? { ...row, pushedRefs: [...row.pushedRefs.filter((entry) => entry.provider !== provider), ref] }
          : row,
      ),
    );
    toast.push({ tone: "success", title: "Task pushed", description: ref.label });
    setPushItem(null);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const now = Date.now();
    return items.filter((item) => {
      if (status === "open" && item.status !== "open") return false;
      if (status === "done" && item.status !== "done") return false;
      if (status === "overdue") {
        if (item.status === "done") return false;
        if (!item.dueAt || new Date(item.dueAt).getTime() >= now) return false;
      }
      if (!needle) return true;
      return (
        item.text.toLowerCase().includes(needle) ||
        item.meetingTitle.toLowerCase().includes(needle) ||
        (item.assigneeName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, status, query]);

  const groups = useMemo(() => {
    const map = new Map<string, ActionItemRow[]>();
    for (const item of filtered) {
      const key = groupKey(item, groupBy);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return Array.from(map.entries());
  }, [filtered, groupBy]);

  const setItemStatus = async (item: ActionItemRow, next: "open" | "done") => {
    const previous = item.status;
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, status: next } : row)),
    );
    const result = await patchActionItem(item.id, { status: next });
    if (result.error) {
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, status: previous } : row)),
      );
      toast.push({
        tone: "error",
        title: "Could not update the task",
        description: result.error,
      });
      return;
    }
    toast.push({
      tone: "success",
      title: next === "done" ? "Task completed" : "Task reopened",
    });
  };

  const bulkComplete = async () => {
    if (!selected.length) return;
    setBusy(true);
    const results = await Promise.all(
      selected.map((id) => patchActionItem(id, { status: "done" })),
    );
    const failed = results.filter((result) => result.error);
    if (failed.length) {
      toast.push({
        tone: "error",
        title: `${failed.length} task${failed.length === 1 ? "" : "s"} did not update`,
        description: failed[0].error ?? undefined,
      });
    } else {
      toast.push({ tone: "success", title: `${selected.length} tasks marked done` });
    }
    setItems((current) =>
      current.map((row) =>
        selected.includes(row.id) && !failed.length ? { ...row, status: "done" } : row,
      ),
    );
    setSelected([]);
    setBusy(false);
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "click-tasks.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.push({ tone: "success", title: "Export downloaded", description: `${filtered.length} tasks` });
  };

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selected.includes(item.id));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Tasks</h2>
          <p className="text-sm text-text-muted">
            Every commitment pulled out of your meetings, in one list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </Button>
          <Button size="sm" onClick={() => void openNewTask()}>
            New task
          </Button>
        </div>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="task-search">
              Search tasks
            </label>
            <Input
              id="task-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Task, meeting or owner…"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="task-status">
              Status
            </label>
            <Select
              id="task-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              <option value="all">All tasks</option>
              <option value="open">Open</option>
              <option value="overdue">Overdue</option>
              <option value="done">Done</option>
            </Select>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="task-group">
              Group by
            </label>
            <Select
              id="task-group"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as GroupBy)}
            >
              <option value="meeting">Meeting</option>
              <option value="due">Due date</option>
              <option value="assignee">Owner</option>
            </Select>
          </div>
          {status !== "all" || query ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </Card>

      {error ? (
        <Banner
          tone="danger"
          title="Tasks could not be loaded"
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
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16" rounded="lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No tasks yet"
            description="Click extracts commitments from meeting notes. Transcribe a meeting and the tasks land here."
            action={
              <Link href="/app/meetings">
                <Button size="sm">Go to meetings</Button>
              </Link>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No tasks match these filters"
            description="Change the status filter or clear the search to see the rest."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatus("all");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                className="size-4 rounded border-border-input"
                checked={allVisibleSelected}
                onChange={() =>
                  setSelected(
                    allVisibleSelected
                      ? selected.filter((id) => !filtered.some((item) => item.id === id))
                      : Array.from(new Set([...selected, ...filtered.map((item) => item.id)])),
                  )
                }
              />
              Select all {filtered.length}
            </label>
            <Badge tone="neutral">
              {filtered.length} of {items.length} tasks
            </Badge>
          </div>

          {selected.length > 0 ? (
            <Card className="mb-3 flex flex-wrap items-center justify-between gap-3 border-accent p-3">
              <p className="text-sm font-medium text-text">
                {selected.length} selected
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={bulkComplete} loading={busy}>
                  Mark done
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4">
            {groups.map(([name, groupItems]) => (
              <section key={name} aria-label={name}>
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {name}
                </h3>
                <Card className="divide-y divide-border">
                  {groupItems.map((item) => {
                    const due = dueLabel(item.dueAt);
                    const done = item.status === "done";
                    return (
                      <div key={item.id} className="flex items-start gap-3 p-3">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 rounded border-border-input"
                          checked={selected.includes(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          aria-label={`Select task: ${item.text}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={
                              done
                                ? "text-sm text-text-muted line-through"
                                : "text-sm font-medium text-text"
                            }
                          >
                            {item.text}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-text-muted">
                            <Link
                              href={`/app/meetings/${item.meetingId}`}
                              className="hover:text-accent hover:underline"
                              title={item.meetingTitle}
                            >
                              {item.meetingTitle}
                            </Link>
                          </p>
                          {item.pushedRefs.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.pushedRefs.map((ref) =>
                                ref.url ? (
                                  <a
                                    key={ref.provider}
                                    href={ref.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:opacity-80"
                                  >
                                    <Badge tone="accent">{ref.label}</Badge>
                                  </a>
                                ) : (
                                  <Badge key={ref.provider} tone="accent">
                                    {ref.label}
                                  </Badge>
                                ),
                              )}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-text-muted">
                            {item.assigneeName ?? "Unassigned"}
                          </span>
                          {done ? (
                            <Badge tone="success">Done</Badge>
                          ) : due.overdue ? (
                            <Badge tone="danger">{due.text}</Badge>
                          ) : due.soon ? (
                            <Badge tone="warning">{due.text}</Badge>
                          ) : (
                            <span className="text-xs text-text-muted">{due.text}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void openPush(item)}
                          title="Push this task to a project tool"
                        >
                          Push
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setItemStatus(item, done ? "open" : "done")}
                        >
                          {done ? "Reopen" : "Done"}
                        </Button>
                      </div>
                    );
                  })}
                </Card>
              </section>
            ))}
          </div>
        </>
      )}

      <Dialog open={newTaskOpen} onClose={() => setNewTaskOpen(false)} title="New task">
        <div className="grid gap-3">
          <Field label="Meeting" htmlFor="new-task-meeting">
            <Select
              id="new-task-meeting"
              value={newTaskMeeting}
              onChange={(event) => setNewTaskMeeting(event.target.value)}
            >
              <option value="">Pick a meeting</option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Task" htmlFor="new-task-text">
            <Input
              id="new-task-text"
              value={newTaskText}
              maxLength={2000}
              placeholder="What needs to be done?"
              onChange={(event) => setNewTaskText(event.target.value)}
            />
          </Field>
          <Field label="Owner" htmlFor="new-task-assignee" hint="Optional.">
            <Input
              id="new-task-assignee"
              value={newTaskAssignee}
              maxLength={120}
              placeholder="Who is doing it?"
              onChange={(event) => setNewTaskAssignee(event.target.value)}
            />
          </Field>
          <Field label="Due date" htmlFor="new-task-due" hint="Optional.">
            <Input
              id="new-task-due"
              type="date"
              value={newTaskDue}
              onChange={(event) => setNewTaskDue(event.target.value)}
            />
          </Field>
          {newTaskError ? <p className="text-xs text-danger">{newTaskError}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setNewTaskOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={newTaskSaving} onClick={() => void createTask()}>
            Create task
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={pushItem !== null}
        onClose={() => setPushItem(null)}
        title="Push task to a project tool"
        description={pushItem?.text}
      >
        {toolsLoading ? (
          <div className="grid gap-2">
            <Skeleton className="h-12" rounded="lg" />
            <Skeleton className="h-12" rounded="lg" />
          </div>
        ) : tools.length === 0 ? (
          <EmptyState
            title="No project tools connected"
            description="Connect Jira, Linear, Asana, ClickUp, Trello or monday.com on the Integrations page first."
            action={
              <Link href="/app/integrations">
                <Button size="sm">Go to integrations</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-2">
            {tools.map((tool) => (
              <div
                key={tool.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">{tool.name}</p>
                  <p className="text-xs text-text-muted">
                    {tool.target}
                    {tool.hasCredentials ? "" : " · no API token saved"}
                  </p>
                </div>
                <Button
                  size="sm"
                  loading={pushingTool === tool.key}
                  disabled={!tool.hasCredentials}
                  onClick={() => void pushToTool(tool.key)}
                >
                  Push
                </Button>
              </div>
            ))}
          </div>
        )}
        {pushError ? <p className="mt-3 text-xs text-danger">{pushError}</p> : null}
      </Dialog>
    </div>
  );
}
