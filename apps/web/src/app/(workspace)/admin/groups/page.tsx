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
  addGroupMember,
  createGroup,
  deleteGroup,
  fetchGroups,
  fetchMembers,
  removeGroupMember,
  updateGroup,
  type GroupRow,
} from "@/lib/api";
import type { WorkspaceMemberRow } from "@/lib/api";

export default function GroupsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addMemberGroup, setAddMemberGroup] = useState<GroupRow | null>(null);
  const [selectedMember, setSelectedMember] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [groupResult, memberResult] = await Promise.all([fetchGroups(), fetchMembers()]);
    if (groupResult.data) setGroups(groupResult.data.groups);
    if (memberResult.data) setMembers(memberResult.data.members);
    const message = groupResult.error ?? memberResult.error;
    if (message) setError(message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      setFormError("Give the group a name.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const result = await createGroup({ name: name.trim() });
    setSaving(false);
    if (result.error || !result.data) {
      setFormError(result.error ?? "That group could not be created.");
      return;
    }
    setDialog(false);
    setName("");
    toast.push({ tone: "success", title: "Group created" });
    await load();
  };

  const remove = async (group: GroupRow) => {
    if (!window.confirm(`Delete “${group.name}”?`)) return;
    const result = await deleteGroup(group.id);
    if (result.error) {
      toast.push({ tone: "error", title: "Group could not be deleted", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Group deleted" });
    await load();
  };

  const addMember = async () => {
    if (!addMemberGroup || !selectedMember) return;
    const result = await addGroupMember(addMemberGroup.id, selectedMember);
    if (result.error) {
      toast.push({ tone: "error", title: "Member could not be added", description: result.error });
      return;
    }
    setAddMemberGroup(null);
    setSelectedMember("");
    toast.push({ tone: "success", title: "Member added" });
    await load();
  };

  const removeMember = async (groupId: string, userId: string) => {
    const result = await removeGroupMember(groupId, userId);
    if (result.error) {
      toast.push({ tone: "error", title: "Member could not be removed", description: result.error });
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Groups</h2>
          <p className="text-sm text-text-muted">
            Teams for sharing notes, templates and meeting rules.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog(true)}>
          New group
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Groups could not be loaded"
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
          <Skeleton className="h-32" rounded="lg" />
          <Skeleton className="h-32" rounded="lg" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            title="No groups yet"
            description="Create a group to share notes and templates with a team."
            action={
              <Button size="sm" onClick={() => setDialog(true)}>
                New group
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader
                title={group.name}
                description={`${group.members.length} member${group.members.length === 1 ? "" : "s"}`}
                actions={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setAddMemberGroup(group);
                        setSelectedMember("");
                      }}
                    >
                      Add member
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void remove(group)}>
                      Delete
                    </Button>
                  </div>
                }
              />
              {group.members.length === 0 ? (
                <p className="p-4 text-xs text-text-muted">No members yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {group.members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-text">{member.name}</p>
                        <p className="text-xs text-text-muted">{member.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeMember(group.id, member.id)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} title="New group">
        <div className="grid gap-3">
          <Field label="Name" htmlFor="group-name">
            <Input
              id="group-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          {formError ? <p className="text-xs text-danger">{formError}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDialog(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => void create()}>
            Create group
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={addMemberGroup !== null}
        onClose={() => setAddMemberGroup(null)}
        title={addMemberGroup ? `Add member to ${addMemberGroup.name}` : "Add member"}
      >
        <div className="grid gap-3">
          <Field label="Member" htmlFor="group-member">
            <select
              id="group-member"
              value={selectedMember}
              onChange={(event) => setSelectedMember(event.target.value)}
              className="h-10 w-full rounded-md border border-border-input bg-surface px-3 text-base text-text"
            >
              <option value="">Choose a member</option>
              {members
                .filter(
                  (member) =>
                    !addMemberGroup?.members.some((existing) => existing.id === member.id),
                )
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.email}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAddMemberGroup(null)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!selectedMember} onClick={() => void addMember()}>
            Add member
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
