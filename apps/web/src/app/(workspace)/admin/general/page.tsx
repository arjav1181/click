"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  addOrgDomain,
  deleteOrg,
  fetchMembers,
  fetchOrg,
  removeOrgDomain,
  transferOrgOwnership,
  updateOrg,
  updateOrgDefaults,
  type WorkspaceDefaults,
  type WorkspaceDto,
  type WorkspaceMemberRow,
} from "@/lib/api";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "ja", label: "Japanese" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
];

const DEFAULT_DEFAULTS: WorkspaceDefaults = {
  autoSummarize: true,
  defaultLanguage: "en",
  defaultPrivacy: "private",
};

type DialogKind = "transfer" | "delete" | null;

export default function WorkspaceSetupPage() {
  const toast = useToast();
  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainConflict, setDomainConflict] = useState<string | null>(null);

  const [defaults, setDefaults] = useState<WorkspaceDefaults>(DEFAULT_DEFAULTS);
  const [defaultsBusy, setDefaultsBusy] = useState(false);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [transferTarget, setTransferTarget] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [orgResult, memberResult] = await Promise.all([fetchOrg(), fetchMembers()]);
    if (orgResult.data) {
      setWorkspace(orgResult.data);
      setName(orgResult.data.org?.name ?? "");
      setLogoUrl(orgResult.data.org?.logoUrl ?? "");
      setDefaults(orgResult.data.defaults ?? DEFAULT_DEFAULTS);
    }
    if (memberResult.data) setMembers(memberResult.data.members);
    const message = orgResult.error ?? memberResult.error;
    if (message) setError(message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const role = workspace?.role ?? null;
  const canEdit = role === "owner" || role === "admin";
  const isOwner = role === "owner";

  const changed = useMemo(() => {
    if (!workspace?.org) return false;
    return (
      name.trim() !== workspace.org.name ||
      logoUrl.trim() !== (workspace.org.logoUrl ?? "")
    );
  }, [workspace, name, logoUrl]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setProfileError("Give the workspace a name.");
      return;
    }
    setProfileError(null);
    setSavingProfile(true);
    const result = await updateOrg({
      name: name.trim(),
      logoUrl: logoUrl.trim() || null,
    });
    setSavingProfile(false);
    if (result.error) {
      setProfileError(result.error);
      toast.push({ tone: "error", title: "Workspace did not save", description: result.error });
      return;
    }
    const refreshed = await fetchOrg();
    if (refreshed.data) {
      setWorkspace(refreshed.data);
      setName(refreshed.data.org?.name ?? "");
      setLogoUrl(refreshed.data.org?.logoUrl ?? "");
    }
    toast.push({ tone: "success", title: "Workspace saved" });
  };

  const addDomain = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = domain.trim().replace(/^@/, "");
    if (!value) {
      setDomainError("Enter a domain such as example.com.");
      return;
    }
    setDomainBusy(true);
    setDomainError(null);
    setDomainConflict(null);
    const result = await addOrgDomain(value);
    setDomainBusy(false);
    if (result.error) {
      setDomainError(result.error);
      if (/already used/i.test(result.error)) setDomainConflict(result.error);
      return;
    }
    if (result.data) {
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              org: prev.org ? { ...prev.org, domainAllowlist: result.data!.domainAllowlist } : prev.org,
            }
          : prev,
      );
      setDomain("");
      toast.push({ tone: "success", title: `${value} can now auto-join` });
    }
  };

  const removeDomain = async (value: string) => {
    setDomainBusy(true);
    setDomainError(null);
    const result = await removeOrgDomain(value);
    setDomainBusy(false);
    if (result.error) {
      setDomainError(result.error);
      return;
    }
    if (result.data) {
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              org: prev.org ? { ...prev.org, domainAllowlist: result.data!.domainAllowlist } : prev.org,
            }
          : prev,
      );
    }
  };

  const saveDefaults = async (patch: Partial<WorkspaceDefaults>) => {
    setDefaultsBusy(true);
    const result = await updateOrgDefaults(patch);
    setDefaultsBusy(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Defaults did not save", description: result.error });
      await load();
      return;
    }
    if (result.data) {
      setDefaults(result.data.defaults);
      setWorkspace((prev) =>
        prev ? { ...prev, defaults: result.data!.defaults } : prev,
      );
    }
  };

  const doTransfer = async () => {
    if (!transferTarget) {
      setDialogError("Pick who should take over.");
      return;
    }
    setDialogBusy(true);
    setDialogError(null);
    const result = await transferOrgOwnership(transferTarget);
    setDialogBusy(false);
    if (result.error) {
      setDialogError(result.error);
      return;
    }
    setDialog(null);
    setTransferTarget("");
    toast.push({ tone: "success", title: "Ownership transferred" });
    await load();
  };

  const doDelete = async () => {
    setDialogBusy(true);
    setDialogError(null);
    const result = await deleteOrg(confirmName.trim());
    setDialogBusy(false);
    if (result.error) {
      setDialogError(result.error);
      return;
    }
    setDialog(null);
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-64" rounded="lg" />
          <Skeleton className="h-56" rounded="lg" />
          <Skeleton className="h-48" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Card>
          <EmptyState
            title="Workspace settings could not be loaded"
            description={error}
            action={
              <Button size="sm" onClick={load}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const org = workspace?.org ?? null;
  const domains = org?.domainAllowlist ?? [];
  const ownerCount = members.filter((member) => member.role === "owner" && member.status === "active").length;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Workspace setup</h2>
        <p className="text-sm text-text-muted">
          {org ? (
            <>
              <span className="break-all">{org.slug}</span> · {workspace?.counts.members ?? 0} members ·{" "}
              {workspace?.counts.active ?? 0} active
            </>
          ) : (
            "Name, logo, domain auto-join and workspace defaults."
          )}
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Some workspace settings could not be loaded"
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

      {!canEdit ? (
        <Banner tone="warning" title="You can only view this page" className="mb-4">
          You need to be a workspace owner or admin to change these settings. Ask an owner for access.
        </Banner>
      ) : null}

      <div className="grid gap-4">
        <Card>
          <CardHeader
            title="Workspace"
            description="The name and logo your team sees across Click."
            actions={role ? <Badge tone="accent">{role}</Badge> : null}
          />
          <form className="grid gap-4 p-4" onSubmit={saveProfile}>
            <div className="flex items-center gap-4">
              <Avatar name={name || org?.name || "?"} size="lg" square src={logoUrl.trim() || undefined} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{name || "Untitled workspace"}</p>
                <p className="truncate text-xs text-text-muted">
                  {logoUrl.trim() ? "Custom logo" : "Initials logo"}
                </p>
              </div>
            </div>
            <Field label="Workspace name" htmlFor="workspace-name" error={profileError ?? undefined}>
              <Input
                id="workspace-name"
                value={name}
                maxLength={120}
                disabled={!canEdit}
                invalid={Boolean(profileError)}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field
              label="Logo URL"
              htmlFor="workspace-logo"
              hint="Paste a link to a square image. Leave blank to use initials."
            >
              <Input
                id="workspace-logo"
                type="url"
                value={logoUrl}
                maxLength={2000}
                placeholder="https://example.com/logo.png"
                disabled={!canEdit}
                onChange={(event) => setLogoUrl(event.target.value)}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={savingProfile} disabled={!canEdit || !changed}>
                Save workspace
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Domain auto-join"
            description="People with these email domains join this workspace on sign-up."
            actions={<Badge tone={domains.length ? "success" : "neutral"}>{domains.length} domains</Badge>}
          />
          <div className="grid gap-4 p-4">
            {domainConflict ? (
              <Banner tone="danger" title="Domain already claimed">
                {domainConflict}
              </Banner>
            ) : null}
            {domainError && !domainConflict ? (
              <p className="text-xs text-danger">{domainError}</p>
            ) : null}

            {domains.length === 0 ? (
              <EmptyState
                title="No domains yet"
                description="Add a company domain and teammates with that email address join automatically."
              />
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {domains.map((entry) => (
                  <li key={entry} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 break-all text-sm text-text">{entry}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canEdit || domainBusy}
                      onClick={() => void removeDomain(entry)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={addDomain}>
              <Field
                label="Add a domain"
                htmlFor="workspace-domain"
                hint="Example: example.com"
                className="flex-1"
              >
                <Input
                  id="workspace-domain"
                  value={domain}
                  maxLength={200}
                  placeholder="example.com"
                  disabled={!canEdit}
                  onChange={(event) => setDomain(event.target.value)}
                />
              </Field>
              <Button type="submit" size="sm" loading={domainBusy} disabled={!canEdit}>
                Add domain
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <CardHeader title="Defaults" description="What new meetings start with." />
          <div className="divide-y divide-border">
            <label className="flex cursor-pointer items-start gap-3 p-4 hover:bg-surface-2">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--color-accent)]"
                checked={defaults.autoSummarize}
                disabled={!canEdit || defaultsBusy}
                onChange={(event) => void saveDefaults({ autoSummarize: event.target.checked })}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Auto-summarize</span>
                <span className="block text-xs text-text-muted">
                  Write AI notes as soon as a transcript is ready.
                </span>
              </span>
            </label>

            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Default language" htmlFor="workspace-language">
                <Select
                  id="workspace-language"
                  value={defaults.defaultLanguage}
                  disabled={!canEdit || defaultsBusy}
                  onChange={(event) => void saveDefaults({ defaultLanguage: event.target.value })}
                >
                  {LANGUAGES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Default visibility"
                htmlFor="workspace-privacy"
                hint="New meetings are private to the host unless you change this."
              >
                <Select
                  id="workspace-privacy"
                  value={defaults.defaultPrivacy}
                  disabled={!canEdit || defaultsBusy}
                  onChange={(event) =>
                    void saveDefaults({
                      defaultPrivacy: event.target.value as "private" | "workspace",
                    })
                  }
                >
                  <option value="private">Private</option>
                  <option value="workspace">Everyone in the workspace</option>
                </Select>
              </Field>
            </div>
          </div>
        </Card>

        <Card className="border-danger">
          <CardHeader
            title="Danger zone"
            description="These actions affect the whole workspace and cannot be undone."
          />
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">Transfer ownership</p>
                <p className="text-xs text-text-muted">
                  Hand the workspace to another member. You become an admin.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={!isOwner || ownerCount === 0}
                onClick={() => {
                  setDialogError(null);
                  setDialog("transfer");
                }}
              >
                Transfer
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-danger">Delete this workspace</p>
                <p className="text-xs text-text-muted">
                  Removes every meeting, transcript and note in this workspace.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                disabled={!isOwner}
                onClick={() => {
                  setDialogError(null);
                  setConfirmName("");
                  setDialog("delete");
                }}
              >
                Delete workspace
              </Button>
            </div>

            {!isOwner ? (
              <p className="text-xs text-text-muted">
                Only the workspace owner can transfer ownership or delete the workspace.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Dialog
        open={dialog === "transfer"}
        onClose={() => setDialog(null)}
        title="Transfer ownership"
        description="The new owner can do everything you can do now. You become an admin."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={dialogBusy} onClick={() => void doTransfer()}>
              Transfer ownership
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="New owner" htmlFor="transfer-target" error={dialogError ?? undefined}>
            <Select
              id="transfer-target"
              value={transferTarget}
              onChange={(event) => setTransferTarget(event.target.value)}
            >
              <option value="">Choose a member</option>
              {members
                .filter((member) => member.status === "active")
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.email}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Delete workspace"
        description="Every meeting, transcript, note and member in this workspace is removed. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={dialogBusy} onClick={() => void doDelete()}>
              Delete workspace
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field
            label={`Type "${org?.name ?? "workspace name"}" to confirm`}
            htmlFor="delete-confirm"
            error={dialogError ?? undefined}
          >
            <Input
              id="delete-confirm"
              value={confirmName}
              autoComplete="off"
              onChange={(event) => setConfirmName(event.target.value)}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
