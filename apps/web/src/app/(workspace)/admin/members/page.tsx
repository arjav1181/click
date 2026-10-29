"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
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
  fetchMembers,
  inviteMember,
  updateMember,
  type WorkspaceMemberRow,
} from "@/lib/api";

export default function AdminMembersPage() {
  const toast = useToast();
  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "invited" | "deactivated">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    fetchMembers().then((result) => {
      if (result.data) setMembers(result.data.members);
      if (result.error) {
        setError(result.error);
        if (result.status === 403) setForbidden(true);
      }
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (statusFilter !== "all" && member.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        member.name.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle)
      );
    });
  }, [members, query, statusFilter]);

  const changeRole = async (
    member: WorkspaceMemberRow,
    role: "owner" | "admin" | "member",
  ) => {
    setBusyId(member.id);
    const result = await updateMember(member.id, { role });
    setBusyId(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Role did not change", description: result.error });
      return;
    }
    if (result.data?.member) {
      setMembers((current) =>
        current.map((row) => (row.id === member.id ? (result.data!.member as WorkspaceMemberRow) : row)),
      );
    }
    toast.push({ tone: "success", title: "Role updated" });
  };

  const changeStatus = async (member: WorkspaceMemberRow, status: "active" | "deactivated") => {
    setBusyId(member.id);
    const result = await updateMember(member.id, { status });
    setBusyId(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Status did not change", description: result.error });
      return;
    }
    if (result.data?.member) {
      setMembers((current) =>
        current.map((row) => (row.id === member.id ? (result.data!.member as WorkspaceMemberRow) : row)),
      );
    }
    toast.push({
      tone: status === "deactivated" ? "warning" : "success",
      title: status === "deactivated" ? "Member deactivated" : "Member reactivated",
    });
  };

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) {
      setInviteError("Enter an email address.");
      return;
    }
    setInviting(true);
    setInviteError(null);
    setDevLink(null);
    const result = await inviteMember({ email: inviteEmail.trim(), role: inviteRole });
    setInviting(false);
    if (result.error) {
      setInviteError(result.error);
      return;
    }
    toast.push({ tone: "success", title: "Invitation sent", description: inviteEmail.trim() });
    setInviteEmail("");
    if (result.data?.devLink) setDevLink(result.data.devLink);
    load();
  };

  if (forbidden) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Admin access required"
            description="Only owners and admins can manage workspace members."
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
          <h2 className="text-xl font-semibold text-text">Members</h2>
          <p className="text-sm text-text-muted">
            Invite teammates, set roles, and deactivate access.
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          Invite member
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Members could not be loaded"
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
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="member-search">
              Search members
            </label>
            <Input
              id="member-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or email…"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="member-status">
              Status
            </label>
            <Select
              id="member-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | "active" | "invited" | "deactivated")
              }
            >
              <option value="all">All members</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="deactivated">Deactivated</option>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16" rounded="lg" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <EmptyState
            title="No members yet"
            description="Invite your first teammate to get started."
            action={
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                Invite member
              </Button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No members match"
            description="Try another search or change the status filter."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-3 p-3">
                <Avatar name={member.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{member.name}</p>
                  <p className="truncate text-xs text-text-muted">{member.email}</p>
                </div>
                <Badge
                  tone={
                    member.status === "active"
                      ? "success"
                      : member.status === "invited"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {member.status}
                </Badge>
                <div className="w-32">
                  <Select
                    aria-label={`Role for ${member.name}`}
                    value={member.role}
                    disabled={busyId === member.id}
                    onChange={(event) =>
                      changeRole(member, event.target.value as "owner" | "admin" | "member")
                    }
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </Select>
                </div>
                <span className="w-24 text-xs text-text-muted">
                  {member.lastSeenAt
                    ? `Seen ${new Date(member.lastSeenAt).toLocaleDateString()}`
                    : "Never seen"}
                </span>
                {member.status === "deactivated" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === member.id}
                    onClick={() => changeStatus(member, "active")}
                  >
                    Reactivate
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === member.id}
                    onClick={() => changeStatus(member, "deactivated")}
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a teammate"
        description="They receive an email link to join this workspace."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitInvite} loading={inviting}>
              Send invitation
            </Button>
          </>
        }
      >
        <form className="grid gap-4" onSubmit={submitInvite}>
          <Field label="Email address" htmlFor="invite-email">
            <Input
              id="invite-email"
              data-autofocus
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="colleague@company.com"
              invalid={Boolean(inviteError)}
            />
          </Field>
          <Field label="Role" htmlFor="invite-role">
            <Select
              id="invite-role"
              value={inviteRole}
              onChange={(event) =>
                setInviteRole(event.target.value as "owner" | "admin" | "member")
              }
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </Select>
          </Field>
          {inviteError ? <p className="text-sm text-danger">{inviteError}</p> : null}
          {devLink ? (
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <p className="text-xs font-semibold text-text-muted">Development sign-in link</p>
              <a href={devLink} className="mt-1 block break-all text-xs text-accent hover:underline">
                {devLink}
              </a>
            </div>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
