"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  addVocabularyTerm,
  deleteVocabularyTerm,
  fetchVocabulary,
  type VocabularyTermRow,
} from "@/lib/api";

export default function VocabularyPage() {
  const toast = useToast();
  const [terms, setTerms] = useState<VocabularyTermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<"name" | "term" | "acronym">("term");
  const [scope, setScope] = useState<"personal" | "workspace">("personal");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchVocabulary();
    if (result.data) setTerms(result.data.terms);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!term.trim()) {
      setFormError("Enter a term.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const result = await addVocabularyTerm({ term: term.trim(), kind, scope });
    setSaving(false);
    if (result.error || (result.data && "ok" in result.data && result.data.ok === false)) {
      setFormError(result.error ?? "That term already exists in this scope.");
      return;
    }
    setTerm("");
    toast.push({ tone: "success", title: "Term added" });
    await load();
  };

  const remove = async (id: string) => {
    const result = await deleteVocabularyTerm(id);
    if (result.error) {
      toast.push({ tone: "error", title: "Term could not be removed", description: result.error });
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Vocabulary</h2>
        <p className="text-sm text-text-muted">
          Teach the transcriber the names, terms and acronyms your team uses so they are spelled correctly.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Vocabulary could not be loaded"
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

      <Card className="mb-4">
        <CardHeader title="Add a term" />
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_140px_160px_auto]">
          <Field label="Term" htmlFor="vocab-term">
            <Input
              id="vocab-term"
              value={term}
              maxLength={200}
              placeholder="Acme Corp"
              onChange={(event) => setTerm(event.target.value)}
            />
          </Field>
          <Field label="Kind" htmlFor="vocab-kind">
            <Select id="vocab-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              <option value="name">Name</option>
              <option value="term">Term</option>
              <option value="acronym">Acronym</option>
            </Select>
          </Field>
          <Field label="Scope" htmlFor="vocab-scope">
            <Select id="vocab-scope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
              <option value="personal">Personal</option>
              <option value="workspace">Workspace</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button size="sm" loading={saving} onClick={() => void add()}>
              Add
            </Button>
          </div>
          {formError ? <p className="text-xs text-danger sm:col-span-4">{formError}</p> : null}
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-14" rounded="lg" />
          <Skeleton className="h-14" rounded="lg" />
        </div>
      ) : terms.length === 0 ? (
        <Card>
          <EmptyState
            title="No vocabulary yet"
            description="Add names and terms so the transcriber gets them right."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Your vocabulary" description="Personal terms are only yours; workspace terms are shared." />
          <ul className="divide-y divide-border">
            {terms.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text">{entry.term}</p>
                    <Badge tone="neutral">{entry.kind}</Badge>
                    <Badge tone={entry.scope === "workspace" ? "accent" : "neutral"}>{entry.scope}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Added by {entry.createdByName ?? "you"} on {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void remove(entry.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
