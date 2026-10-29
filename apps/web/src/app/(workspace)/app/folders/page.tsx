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
  Textarea,
  useToast,
} from "@click/ui";
import {
  createFolder,
  createSpace,
  fetchFolders,
  fetchSpaces,
  type FolderRow,
  type SpaceRow,
} from "@/lib/api";

const spaceKindLabel: Record<SpaceRow["kind"], string> = {
  personal: "Personal",
  team: "Team",
  custom: "Custom",
};

function FolderTree({
  folders,
  spaceId,
  depth = 0,
}: {
  folders: FolderRow[];
  spaceId: string | null;
  depth?: number;
}) {
  const children = folders.filter((folder) => (folder.spaceId ?? null) === spaceId);
  if (!children.length) return null;
  return (
    <ul className={depth ? "ml-4 border-l border-border pl-3" : "grid gap-1"}>
      {children.map((folder) => (
        <li key={folder.id}>
          <Link
            href={`/app/folders/${folder.id}`}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-text transition-colors hover:bg-surface-2"
          >
            <span className="min-w-0 truncate">{folder.name}</span>
            <span className="shrink-0 text-xs text-text-muted">{folder.meetingCount}</span>
          </Link>
          <FolderTree folders={folders} spaceId={folder.id} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export default function FoldersPage() {
  const toast = useToast();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [query, setQuery] = useState("");
  const [folderDialog, setFolderDialog] = useState(false);
  const [spaceDialog, setSpaceDialog] = useState(false);
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<SpaceRow["kind"]>("team");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    Promise.all([fetchFolders(), fetchSpaces()]).then(([folderResult, spaceResult]) => {
      if (folderResult.data) setFolders(folderResult.data.folders);
      if (spaceResult.data) setSpaces(spaceResult.data.spaces);
      const failure = folderResult.error ?? spaceResult.error;
      if (failure) {
        setError(failure);
        if (folderResult.status === 403 || spaceResult.status === 403) setForbidden(true);
      }
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return folders;
    return folders.filter(
      (folder) =>
        folder.name.toLowerCase().includes(needle) ||
        (folder.description ?? "").toLowerCase().includes(needle),
    );
  }, [folders, query]);

  const spaceOf = (folder: FolderRow) => spaces.find((space) => space.id === folder.spaceId) ?? null;

  const submitFolder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Give the folder a name.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await createFolder({
      name: name.trim(),
      spaceId: spaceId || null,
      parentId: parentId || null,
      description: description.trim() || null,
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    toast.push({ tone: "success", title: "Folder created" });
    setFolderDialog(false);
    setName("");
    setDescription("");
    setParentId("");
    load();
  };

  const submitSpace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Give the space a name.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await createSpace({ name: name.trim(), kind, description: description.trim() || null });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    toast.push({ tone: "success", title: "Space created" });
    setSpaceDialog(false);
    setName("");
    setDescription("");
    load();
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Folders & spaces</h2>
          <p className="text-sm text-text-muted">
            Keep meeting notes where your team looks for them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSpaceDialog(true)}>
            New space
          </Button>
          <Button size="sm" onClick={() => setFolderDialog(true)}>
            New folder
          </Button>
        </div>
      </div>

      {error ? (
        <Banner
          tone={forbidden ? "warning" : "danger"}
          title={forbidden ? "You do not have access to these folders" : "Folders could not be loaded"}
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
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-72" rounded="lg" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28" rounded="lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="h-max p-4">
            <h3 className="mb-3 text-sm font-semibold text-text">Spaces</h3>
            {spaces.length === 0 ? (
              <p className="text-xs text-text-muted">
                No spaces yet. Spaces hold folders for a team, a person or a custom grouping.
              </p>
            ) : (
              <div className="grid gap-3">
                {spaces.map((space) => (
                  <div key={space.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-text">{space.name}</span>
                      <Badge tone={space.kind === "personal" ? "neutral" : "accent"}>
                        {spaceKindLabel[space.kind]}
                      </Badge>
                    </div>
                    <div className="mt-1">
                      <FolderTree folders={folders} spaceId={space.id} />
                    </div>
                  </div>
                ))}
                {folders.some((folder) => !folder.spaceId) ? (
                  <div>
                    <span className="text-sm font-medium text-text">Unfiled</span>
                    <div className="mt-1">
                      <FolderTree folders={folders} spaceId={null} />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          <div>
            <Card className="mb-4 p-4">
              <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="folder-search">
                Search folders
              </label>
              <Input
                id="folder-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Folder name or description…"
              />
            </Card>

            {folders.length === 0 ? (
              <Card>
                <EmptyState
                  title="No folders yet"
                  description="Folders group meetings by project, client or team so notes are easy to find."
                  action={
                    <Button size="sm" onClick={() => setFolderDialog(true)}>
                      Create a folder
                    </Button>
                  }
                />
              </Card>
            ) : filtered.length === 0 ? (
              <Card>
                <EmptyState
                  title="No folders match"
                  description="Try another name or clear the search."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((folder) => {
                  const space = spaceOf(folder);
                  const parent = folders.find((row) => row.id === folder.parentId);
                  return (
                    <Link key={folder.id} href={`/app/folders/${folder.id}`} className="block">
                      <Card className="h-full p-4 transition-shadow hover:shadow-pop">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-text">{folder.name}</h3>
                          <Badge tone="neutral">{folder.meetingCount} meetings</Badge>
                        </div>
                        {folder.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-text-muted">{folder.description}</p>
                        ) : (
                          <p className="mt-1 text-xs italic text-text-muted">No description yet</p>
                        )}
                        <p className="mt-3 truncate text-xs text-text-muted">
                          {space ? `${space.name} · ` : ""}
                          {parent ? `in ${parent.name}` : "top level"}
                        </p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={folderDialog}
        onClose={() => setFolderDialog(false)}
        title="New folder"
        description="Folders keep related meeting notes together."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitFolder} loading={saving}>
              Create folder
            </Button>
          </>
        }
      >
        <form className="grid gap-4" onSubmit={submitFolder}>
          <Field label="Folder name" htmlFor="folder-name">
            <Input
              id="folder-name"
              data-autofocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Q3 planning"
              invalid={Boolean(formError)}
            />
          </Field>
          <Field label="Space" htmlFor="folder-space" hint="Leave empty to keep the folder unfiled.">
            <Select id="folder-space" value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>
              <option value="">No space</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Parent folder" htmlFor="folder-parent" hint="Nest this folder inside another one.">
            <Select id="folder-parent" value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">Top level</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="folder-description">
            <Textarea
              id="folder-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What belongs in this folder?"
            />
          </Field>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        </form>
      </Dialog>

      <Dialog
        open={spaceDialog}
        onClose={() => setSpaceDialog(false)}
        title="New space"
        description="Spaces are the top level of your folder tree."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSpaceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitSpace} loading={saving}>
              Create space
            </Button>
          </>
        }
      >
        <form className="grid gap-4" onSubmit={submitSpace}>
          <Field label="Space name" htmlFor="space-name">
            <Input
              id="space-name"
              data-autofocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer success"
              invalid={Boolean(formError)}
            />
          </Field>
          <Field label="Kind" htmlFor="space-kind">
            <Select
              id="space-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as SpaceRow["kind"])}
            >
              <option value="team">Team space</option>
              <option value="personal">Personal space</option>
              <option value="custom">Custom space</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="space-description">
            <Textarea
              id="space-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this space is for"
            />
          </Field>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        </form>
      </Dialog>
    </div>
  );
}
