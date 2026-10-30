"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Textarea,
  useToast,
} from "@click/ui";
import {
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  updateTemplate,
  type TemplateRow,
  type TemplateSection,
} from "@/lib/api";

type Filter = "all" | "builtin" | "mine" | "workspace";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "builtin", label: "Built-in" },
  { key: "mine", label: "Mine" },
  { key: "workspace", label: "Workspace" },
];

interface Draft {
  id: string | null;
  name: string;
  description: string;
  prompt: string;
  sections: TemplateSection[];
  scope: "personal" | "workspace";
}

const EMPTY_DRAFT: Draft = {
  id: null,
  name: "",
  description: "",
  prompt: "",
  sections: [],
  scope: "personal",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchTemplates();
    if (result.data) setTemplates(result.data.templates);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "builtin") return templates.filter((template) => template.isBuiltin);
    if (filter === "workspace") {
      return templates.filter((template) => !template.isBuiltin && template.scope === "workspace");
    }
    if (filter === "mine") {
      return templates.filter((template) => !template.isBuiltin && template.scope === "personal");
    }
    return templates;
  }, [templates, filter]);

  const openEditor = (template: TemplateRow | null) => {
    setFormError(null);
    if (!template) {
      setDraft({ ...EMPTY_DRAFT });
      return;
    }
    setDraft({
      id: template.id,
      name: template.name,
      description: template.description,
      prompt: template.prompt,
      sections: template.sections.map((section) => ({ ...section })),
      scope: template.scope === "workspace" ? "workspace" : "personal",
    });
  };

  const setSection = (index: number, patch: Partial<TemplateSection>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((section, position) =>
        position === index ? { ...section, ...patch } : section,
      );
      return { ...prev, sections };
    });
  };

  const addSection = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const key = slugify(`section_${prev.sections.length + 1}`) || `section_${prev.sections.length + 1}`;
      return {
        ...prev,
        sections: [...prev.sections, { key, title: `Section ${prev.sections.length + 1}` }],
      };
    });
  };

  const removeSection = (index: number) => {
    setDraft((prev) =>
      prev ? { ...prev, sections: prev.sections.filter((_, position) => position !== index) } : prev,
    );
  };

  const moveSection = (index: number, delta: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const target = index + delta;
      if (target < 0 || target >= prev.sections.length) return prev;
      const sections = [...prev.sections];
      const [moved] = sections.splice(index, 1);
      sections.splice(target, 0, moved);
      return { ...prev, sections };
    });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setFormError("Give the template a name.");
      return;
    }
    if (draft.sections.some((section) => !section.key.trim() || !section.title.trim())) {
      setFormError("Every section needs a key and a title.");
      return;
    }
    const keys = draft.sections.map((section) => section.key.trim().toLowerCase());
    if (new Set(keys).size !== keys.length) {
      setFormError("Section keys have to be unique.");
      return;
    }
    setFormError(null);
    setSaving(true);

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      prompt: draft.prompt.trim() || null,
      sections: draft.sections.map((section) => ({
        key: section.key.trim(),
        title: section.title.trim(),
      })),
      scope: draft.scope,
    };

    const result = draft.id
      ? await updateTemplate(draft.id, payload)
      : await createTemplate({
          name: payload.name,
          description: payload.description ?? undefined,
          prompt: payload.prompt ?? undefined,
          sections: payload.sections,
          scope: payload.scope,
        });

    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setDraft(null);
    toast.push({ tone: "success", title: draft.id ? "Template updated" : "Template created" });
    await load();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    const result = await deleteTemplate(confirmDelete.id);
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      setConfirmDelete(null);
      return;
    }
    setConfirmDelete(null);
    toast.push({ tone: "success", title: "Template deleted" });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Templates</h2>
          <p className="text-sm text-text-muted">
            The shape of every AI summary. Built-in templates ship with Click; your own templates can be
            shared with the workspace.
          </p>
        </div>
        <Button size="sm" onClick={() => openEditor(null)}>
          New template
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Templates could not be loaded"
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

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors ${
              filter === option.key
                ? "bg-accent text-on-accent"
                : "bg-surface-2 text-text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            title={templates.length === 0 ? "No templates yet" : "Nothing in this view"}
            description={
              templates.length === 0
                ? "Create a template to control how meeting notes are structured."
                : "Try another filter."
            }
            action={
              <Button size="sm" onClick={() => openEditor(null)}>
                New template
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{template.name}</span>
                    {template.isBuiltin ? <Badge tone="neutral">Built-in</Badge> : null}
                  </span>
                }
                description={template.description || "No description."}
                actions={
                  template.scope === "workspace" ? <Badge tone="accent">Workspace</Badge> : null
                }
              />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap gap-1">
                  {template.sections.length === 0 ? (
                    <span className="text-xs text-text-muted">No sections — the AI writes free-form notes.</span>
                  ) : (
                    template.sections.map((section) => (
                      <span
                        key={section.key}
                        className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs text-text-muted"
                      >
                        {section.title}
                      </span>
                    ))
                  )}
                </div>
                {template.prompt ? (
                  <p className="line-clamp-3 text-xs text-text-muted">{template.prompt}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-text-muted">
                    {template.isBuiltin
                      ? "Ships with Click"
                      : `${template.ownerName ?? "You"} · ${template.scope === "workspace" ? "Shared" : "Private"}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditor(template)}>
                      {template.isBuiltin ? "Preview" : "Edit"}
                    </Button>
                    {!template.isBuiltin ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormError(null);
                          setConfirmDelete(template);
                        }}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit template" : "New template"}
        description="Sections become the headings of the generated note."
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              {draft?.id ? "Save template" : "Create template"}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div className="grid gap-3">
              <Field label="Name" htmlFor="template-name">
                <Input
                  id="template-name"
                  value={draft.name}
                  maxLength={120}
                  disabled={draft.id !== null && templates.find((t) => t.id === draft.id)?.isBuiltin}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
              <Field label="Description" htmlFor="template-description">
                <Input
                  id="template-description"
                  value={draft.description}
                  maxLength={500}
                  placeholder="What this template is for"
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
              <Field
                label="Prompt"
                htmlFor="template-prompt"
                hint="Extra instructions for the AI on top of the section list."
              >
                <Textarea
                  id="template-prompt"
                  rows={4}
                  value={draft.prompt}
                  maxLength={8000}
                  onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
                />
              </Field>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text">Sections</p>
                  <Button variant="secondary" size="sm" onClick={addSection}>
                    Add section
                  </Button>
                </div>
                {draft.sections.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No sections yet. The AI will write a free-form summary.
                  </p>
                ) : (
                  <ul className="grid gap-2">
                    {draft.sections.map((section, index) => (
                      <li
                        key={`${section.key}-${index}`}
                        className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <Input
                          aria-label="Section title"
                          value={section.title}
                          maxLength={120}
                          placeholder="Title"
                          onChange={(event) => setSection(index, { title: event.target.value })}
                        />
                        <Input
                          aria-label="Section key"
                          value={section.key}
                          maxLength={60}
                          placeholder="key"
                          onChange={(event) => setSection(index, { key: event.target.value })}
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            variant="icon"
                            size="sm"
                            aria-label="Move up"
                            disabled={index === 0}
                            onClick={() => moveSection(index, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="icon"
                            size="sm"
                            aria-label="Move down"
                            disabled={index === draft.sections.length - 1}
                            onClick={() => moveSection(index, 1)}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSection(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Field
                label="Visibility"
                htmlFor="template-scope"
                hint="Workspace templates are visible to every member."
              >
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-text">
                    <input
                      type="radio"
                      name="template-scope"
                      className="size-4 accent-[var(--color-accent)]"
                      checked={draft.scope === "personal"}
                      onChange={() => setDraft({ ...draft, scope: "personal" })}
                    />
                    Personal
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text">
                    <input
                      type="radio"
                      name="template-scope"
                      className="size-4 accent-[var(--color-accent)]"
                      checked={draft.scope === "workspace"}
                      onChange={() => setDraft({ ...draft, scope: "workspace" })}
                    />
                    Workspace
                  </label>
                </div>
              </Field>

              {formError ? <p className="text-xs text-danger">{formError}</p> : null}
            </div>

            <aside className="rounded-md border border-border bg-surface-2 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Preview
              </p>
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-text">{draft.name || "Untitled template"}</p>
                {draft.sections.length === 0 ? (
                  <p className="text-xs text-text-muted">A free-form summary.</p>
                ) : (
                  draft.sections.map((section) => (
                    <div key={`${section.key}-preview`}>
                      <p className="text-xs font-semibold text-text">{section.title || "Untitled"}</p>
                      <p className="text-xs text-text-muted">The AI writes this section…</p>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete template"
        description={`“${confirmDelete?.name ?? ""}” will be removed. Notes already generated with it stay as they are.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={saving} onClick={() => void remove()}>
              Delete template
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          Templates already in use by a meeting are not blocked, but the meeting can no longer regenerate with
          this structure.
        </p>
      </Dialog>
    </div>
  );
}
