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
  Textarea,
  useToast,
} from "@click/ui";
import {
  createLegalHold,
  deleteLegalHold,
  fetchLegalHolds,
  releaseLegalHold,
  type LegalHoldRow,
} from "@/lib/api";

export default function LegalHoldPage() {
  const toast = useToast();
  const [holds, setHolds] = useState<LegalHoldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchLegalHolds();
    if (result.data) setHolds(result.data.holds);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      setFormError("Give the hold a name.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const result = await createLegalHold({ name: name.trim(), description: description.trim() || undefined });
    setSaving(false);
    if (result.error || !result.data) {
      setFormError(result.error ?? "That hold could not be created.");
      return;
    }
    setDialog(false);
    setName("");
    setDescription("");
    toast.push({ tone: "success", title: "Legal hold created" });
    await load();
  };

  const release = async (id: string) => {
    const result = await releaseLegalHold(id);
    if (result.error) {
      toast.push({ tone: "error", title: "Hold could not be released", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Legal hold released" });
    await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this legal hold?")) return;
    const result = await deleteLegalHold(id);
    if (result.error) {
      toast.push({ tone: "error", title: "Hold could not be deleted", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Legal hold deleted" });
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Legal hold</h2>
          <p className="text-sm text-text-muted">
            Preserve data for a matter. While active, retention rules are suspended.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog(true)}>
          New hold
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Legal holds could not be loaded"
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
          <Skeleton className="h-24" rounded="lg" />
          <Skeleton className="h-24" rounded="lg" />
        </div>
      ) : holds.length === 0 ? (
        <Card>
          <EmptyState
            title="No legal holds"
            description="Create a hold to preserve data for a matter."
            action={
              <Button size="sm" onClick={() => setDialog(true)}>
                New hold
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {holds.map((hold) => (
            <Card key={hold.id}>
              <CardHeader
                title={hold.name}
                description={hold.description || "No description."}
                actions={
                  hold.releasedAt ? (
                    <Badge tone="neutral">Released</Badge>
                  ) : (
                    <Badge tone="warning">Active</Badge>
                  )
                }
              />
              <div className="grid gap-2 p-4 text-xs text-text-muted">
                <p>Custodians: {hold.custodianNames.length ? hold.custodianNames.join(", ") : "None"}</p>
                <p>Created {new Date(hold.createdAt).toLocaleString()}</p>
                {hold.releasedAt ? <p>Released {new Date(hold.releasedAt).toLocaleString()}</p> : null}
              </div>
              <div className="flex items-center gap-2 border-t border-border p-4">
                {!hold.releasedAt ? (
                  <Button variant="secondary" size="sm" onClick={() => void release(hold.id)}>
                    Release
                  </Button>
                ) : null}
                <Button variant="danger" size="sm" onClick={() => void remove(hold.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} title="New legal hold">
        <div className="grid gap-3">
          <Field label="Name" htmlFor="hold-name">
            <Input
              id="hold-name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Description" htmlFor="hold-description">
            <Textarea
              id="hold-description"
              rows={3}
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {formError ? <p className="text-xs text-danger">{formError}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDialog(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => void create()}>
            Create hold
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
