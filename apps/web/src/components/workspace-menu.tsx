"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Input } from "@click/ui";
import { createWorkspace, switchWorkspace } from "@/lib/api";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/**
 * The workspace chip in the header. It lists every workspace the account
 * belongs to, opens one on click and creates new ones without leaving the
 * dropdown.
 */
export function WorkspaceMenu({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function select(id: string) {
    if (id === activeWorkspaceId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await switchWorkspace(id);
    if (!result.data) {
      setError(result.error ?? "We could not switch workspace.");
      setBusy(false);
      return;
    }
    // The workspace is part of every server-rendered page, so a reload picks
    // up the new tenant.
    window.location.reload();
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the workspace a name.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createWorkspace(trimmed);
    if (!result.data) {
      setError(result.error ?? "We could not create the workspace.");
      setBusy(false);
      return;
    }
    setCreating(false);
    setName("");
    window.location.reload();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex max-w-[6rem] items-center gap-1 truncate rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted hover:text-text sm:max-w-[12rem]"
      >
        <span className="truncate">{active?.name ?? "No workspace"}</span>
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-8 z-50 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Workspaces
          </p>
          {workspaces.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-text-muted">You are not in a workspace yet.</p>
          ) : (
            <ul className="grid gap-0.5">
              {workspaces.map((workspace) => {
                const isActive = workspace.id === activeWorkspaceId;
                return (
                  <li key={workspace.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      disabled={busy}
                      onClick={() => select(workspace.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-surface-2 disabled:opacity-60"
                    >
                      <span className="truncate">{workspace.name}</span>
                      <span className="shrink-0 text-[10px] uppercase text-text-muted">
                        {isActive ? "Current" : workspace.role}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-1 border-t border-border pt-1">
            {creating ? (
              <form onSubmit={create} className="grid gap-2 px-1 py-1">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Workspace name"
                  aria-label="Workspace name"
                  maxLength={120}
                  autoFocus
                  disabled={busy}
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" loading={busy}>
                    Create
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCreating(false);
                      setError(null);
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => setCreating(true)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-60"
              >
                New workspace
              </button>
            )}
            <Link
              href="/admin/general"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-1.5 text-sm text-text-muted hover:bg-surface-2 hover:text-text"
            >
              Manage workspace
            </Link>
          </div>

          {error ? (
            <p role="alert" className="px-2 pt-1 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
