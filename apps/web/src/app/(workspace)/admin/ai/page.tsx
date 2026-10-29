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
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  deleteProviderConfig,
  fetchAiPolicy,
  saveProviderConfig,
  updateAiPolicy,
  type AiFeatureGates,
  type AiPolicy,
  type AiUsage,
  type ProviderConfigRow,
} from "@/lib/api";

type ProviderKind = "asr" | "llm" | "embedding";
type ProviderState = "configured" | "missing key" | "disabled" | "error";

const KIND_META: Record<ProviderKind, { label: string; purpose: string; placeholder: string }> = {
  asr: {
    label: "Transcription",
    purpose: "Turns meeting audio into a transcript and speaker segments.",
    placeholder: "whisper-1",
  },
  llm: {
    label: "Summaries",
    purpose: "Writes meeting notes, action items and citations.",
    placeholder: "gpt-4o-mini",
  },
  embedding: {
    label: "Embeddings",
    purpose: "Powers semantic search across meetings and folders.",
    placeholder: "text-embedding-3-small",
  },
};

const GATE_META: Array<{
  key: keyof AiFeatureGates;
  label: string;
  description: string;
}> = [
  {
    key: "transcription",
    label: "Transcription",
    description: "Allow uploaded recordings and meeting bots to be transcribed.",
  },
  {
    key: "summaries",
    label: "AI summaries",
    description: "Allow the summary model to write structured meeting notes.",
  },
  {
    key: "actionItems",
    label: "AI action items",
    description: "Extract action items with owners and due dates from transcripts.",
  },
  {
    key: "semanticSearch",
    label: "Semantic search",
    description: "Search by meaning instead of keywords. Needs an embedding provider.",
  },
];

function providerState(row: ProviderConfigRow | undefined): ProviderState {
  if (!row) return "missing key";
  const enabled = row.options?.enabled !== false;
  if (!enabled) return "disabled";
  if (row.status === "error") return "error";
  if (row.provider === "mock") return "configured";
  if (!row.hasKey) return "missing key";
  return "configured";
}

const STATE_TONE: Record<ProviderState, "success" | "warning" | "neutral" | "danger"> = {
  configured: "success",
  "missing key": "warning",
  disabled: "neutral",
  error: "danger",
};

const STATE_LABEL: Record<ProviderState, string> = {
  configured: "Configured",
  "missing key": "Missing key",
  disabled: "Disabled",
  error: "Error",
};

export default function AdminAiPolicyPage() {
  const toast = useToast();
  const [policy, setPolicy] = useState<AiPolicy | null>(null);
  const [providers, setProviders] = useState<ProviderConfigRow[]>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [dialogKind, setDialogKind] = useState<ProviderKind | null>(null);
  const [dialogProvider, setDialogProvider] = useState("openai");
  const [dialogBaseUrl, setDialogBaseUrl] = useState("");
  const [dialogApiKey, setDialogApiKey] = useState("");
  const [dialogModel, setDialogModel] = useState("");
  const [dialogEnabled, setDialogEnabled] = useState(true);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    const result = await fetchAiPolicy();
    if (result.data) {
      setPolicy(result.data.policy);
      setProviders(result.data.providers);
      setUsage(result.data.usage);
      setCapInput(String(result.data.policy.budgetCap));
    }
    if (result.error) {
      setError(result.error);
      if (result.status === 403) setForbidden(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byKind = useMemo(() => {
    const map = new Map<string, ProviderConfigRow>();
    for (const row of providers) {
      if (row.isDefault || !map.has(row.kind)) map.set(row.kind, row);
    }
    return map;
  }, [providers]);

  const budgetUsed = usage?.costEstimate ?? 0;
  const effectiveCap = policy?.budgetCap ?? 0;
  const budgetHit = effectiveCap > 0 && budgetUsed >= effectiveCap;
  const budgetPercent = effectiveCap > 0 ? Math.min(100, Math.round((budgetUsed / effectiveCap) * 100)) : 0;

  const savePolicy = async (patch: Parameters<typeof updateAiPolicy>[0]) => {
    setSaving(true);
    const result = await updateAiPolicy(patch);
    setSaving(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Policy did not save", description: result.error });
      return;
    }
    if (result.data?.policy) setPolicy(result.data.policy);
    toast.push({ tone: "success", title: "Policy saved" });
  };

  const toggleGate = async (key: keyof AiFeatureGates, value: boolean) => {
    if (!policy) return;
    const next = { ...policy.featureGates, [key]: value };
    setPolicy({ ...policy, featureGates: next });
    const result = await updateAiPolicy({ featureGates: { [key]: value } });
    if (result.error) {
      setPolicy(policy);
      toast.push({ tone: "error", title: "Gate did not change", description: result.error });
      return;
    }
    if (result.data?.policy) setPolicy(result.data.policy);
    toast.push({ tone: "success", title: `${GATE_META.find((g) => g.key === key)?.label} ${value ? "on" : "off"}` });
  };

  const saveCap = async () => {
    const parsed = Number(capInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.push({ tone: "error", title: "Enter a valid cap", description: "Use 0 for no cap." });
      return;
    }
    await savePolicy({ budgetCap: parsed });
    const result = await fetchAiPolicy();
    if (result.data) setUsage(result.data.usage);
  };

  const openDialog = (kind: ProviderKind) => {
    const existing = byKind.get(kind);
    setDialogKind(kind);
    setDialogProvider(existing?.provider ?? "openai");
    setDialogBaseUrl(existing?.baseUrl ?? "");
    setDialogApiKey("");
    setDialogModel(existing?.model ?? "");
    setDialogEnabled(existing?.options?.enabled !== false);
    setDialogError(null);
  };

  const submitProvider = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dialogKind) return;
    if (dialogEnabled && dialogProvider !== "mock" && !dialogApiKey.trim() && !byKind.get(dialogKind)?.hasKey) {
      setDialogError("Add an API key, or switch this provider off.");
      return;
    }
    setDialogBusy(true);
    setDialogError(null);
    const result = await saveProviderConfig({
      kind: dialogKind,
      provider: dialogProvider.trim(),
      baseUrl: dialogBaseUrl.trim() || null,
      apiKey: dialogApiKey.trim() || undefined,
      model: dialogModel.trim() || null,
      enabled: dialogEnabled,
    });
    setDialogBusy(false);
    if (result.error) {
      setDialogError(result.error);
      return;
    }
    if (result.data?.providers) setProviders(result.data.providers);
    setDialogKind(null);
    toast.push({ tone: "success", title: "Provider saved" });
  };

  const removeProvider = async (row: ProviderConfigRow) => {
    setBusyId(row.id);
    const result = await deleteProviderConfig(row.id);
    setBusyId(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Provider was not removed", description: result.error });
      return;
    }
    if (result.data?.providers) setProviders(result.data.providers);
    toast.push({ tone: "success", title: "Provider removed" });
  };

  if (forbidden) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Admin access required"
            description="Only owners and admins can change the AI policy for this workspace."
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
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">AI policy</h2>
        <p className="text-sm text-text-muted">
          Bring your own keys, choose models, and set the spend limit for this workspace.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="The AI policy could not be loaded"
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

      {budgetHit ? (
        <Banner tone="warning" title="The monthly AI budget is used up" className="mb-4">
          This workspace spent ${budgetUsed.toFixed(2)} of its ${effectiveCap.toFixed(2)} cap. Transcription and
          summaries pause until the cap is raised or the period rolls over.
        </Banner>
      ) : null}

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-56" rounded="lg" />
          <Skeleton className="h-48" rounded="lg" />
        </div>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader
              title="Providers"
              description="Keys are encrypted at rest and never leave this workspace."
            />
            <div className="divide-y divide-border">
              {(Object.keys(KIND_META) as ProviderKind[]).map((kind) => {
                const row = byKind.get(kind);
                const state = providerState(row);
                return (
                  <div key={kind} className="flex flex-wrap items-start gap-3 p-4">
                    <div className="min-w-[220px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text">{KIND_META[kind].label}</p>
                        <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
                        {row?.isDefault ? <Badge tone="accent">Default</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-text-muted">{KIND_META[kind].purpose}</p>
                      <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-text-muted sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="font-semibold text-text">Provider</dt>
                          <dd className="truncate">{row?.provider ?? "Not set"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-semibold text-text">Model</dt>
                          <dd className="truncate">
                            {row?.model ?? policy?.modelDefaults[kind === "embedding" ? "embeddings" : kind] ?? "—"}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-semibold text-text">Endpoint</dt>
                          <dd className="truncate">{row?.baseUrl ?? "Default"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-semibold text-text">API key</dt>
                          <dd>{row?.hasKey ? "Stored" : "Not stored"}</dd>
                        </div>
                      </dl>
                      {state === "missing key" ? (
                        <p className="mt-2 text-xs text-warning">
                          Add an API key for this provider or turn the feature off until you have one.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openDialog(kind)}>
                        {row ? "Edit" : "Configure"}
                      </Button>
                      {row ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === row.id}
                          onClick={() => removeProvider(row)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Budget cap"
              description="A hard stop on AI spend for this calendar month."
            />
            <div className="grid gap-4 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-48">
                  <Field label="Monthly cap (USD)" htmlFor="budget-cap" hint="0 means no cap.">
                    <Input
                      id="budget-cap"
                      type="number"
                      min={0}
                      step="1"
                      value={capInput}
                      onChange={(event) => setCapInput(event.target.value)}
                      disabled={saving}
                    />
                  </Field>
                </div>
                <Button size="sm" loading={saving} onClick={saveCap}>
                  Save cap
                </Button>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>
                    {`$${budgetUsed.toFixed(2)} spent this period`}
                  </span>
                  <span>{effectiveCap > 0 ? `$${effectiveCap.toFixed(2)} cap` : "No cap"}</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={budgetPercent}
                  className="mt-1 h-2 w-full overflow-hidden rounded-pill bg-surface-2"
                >
                  <div
                    className={`h-full rounded-pill ${budgetHit ? "bg-warning" : "bg-accent"}`}
                    style={{ width: `${effectiveCap > 0 ? budgetPercent : 0}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {usage
                    ? `${usage.asrSeconds.toLocaleString()} s transcribed, ${(
                        usage.llmTokensIn + usage.llmTokensOut
                      ).toLocaleString()} model tokens, ${usage.llmTokensOut.toLocaleString()} output tokens.`
                    : "No usage recorded yet for this period."}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Feature gates"
              description="Turn AI features on or off for everyone in this workspace."
            />
            <div className="divide-y divide-border">
              {GATE_META.map((gate) => {
                const on = policy?.featureGates[gate.key] ?? false;
                return (
                  <label
                    key={gate.key}
                    className="flex cursor-pointer items-start gap-3 p-4 hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-[var(--color-accent)]"
                      checked={on}
                      disabled={saving}
                      onChange={(event) => void toggleGate(gate.key, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-text">{gate.label}</span>
                      <span className="mt-0.5 block text-xs text-text-muted">{gate.description}</span>
                    </span>
                    <Badge tone={on ? "success" : "neutral"}>{on ? "On" : "Off"}</Badge>
                  </label>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      <Dialog
        open={dialogKind !== null}
        onClose={() => setDialogKind(null)}
        title={dialogKind ? `${KIND_META[dialogKind].label} provider` : "Provider"}
        description="The key is encrypted before it is stored."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogKind(null)}>
              Cancel
            </Button>
            <Button onClick={submitProvider} loading={dialogBusy}>
              Save provider
            </Button>
          </>
        }
      >
        <form className="grid gap-4" onSubmit={submitProvider}>
          <Field label="Provider" htmlFor="provider-name">
            <Select
              id="provider-name"
              data-autofocus
              value={dialogProvider}
              onChange={(event) => setDialogProvider(event.target.value)}
            >
              <option value="openai">OpenAI-compatible</option>
              <option value="local">Local (self-hosted)</option>
              <option value="mock">Built-in demo</option>
            </Select>
          </Field>
          <Field label="Base URL" htmlFor="provider-url" hint="Leave blank to use the provider default.">
            <Input
              id="provider-url"
              value={dialogBaseUrl}
              onChange={(event) => setDialogBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </Field>
          <Field
            label="API key"
            htmlFor="provider-key"
            hint="Stored encrypted. Leave blank to keep the key already saved."
          >
            <Input
              id="provider-key"
              type="password"
              value={dialogApiKey}
              onChange={(event) => setDialogApiKey(event.target.value)}
              placeholder="sk-…"
              invalid={Boolean(dialogError)}
            />
          </Field>
          <Field label="Model" htmlFor="provider-model" hint="Leave blank to use the workspace default.">
            <Input
              id="provider-model"
              value={dialogModel}
              onChange={(event) => setDialogModel(event.target.value)}
              placeholder={dialogKind ? KIND_META[dialogKind].placeholder : ""}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={dialogEnabled}
              onChange={(event) => setDialogEnabled(event.target.checked)}
            />
            Enabled for this workspace
          </label>
          {dialogError ? <p className="text-sm text-danger">{dialogError}</p> : null}
        </form>
      </Dialog>
    </div>
  );
}
