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
  useToast,
} from "@click/ui";
import {
  createApiKey,
  createWebhook,
  deleteWebhook,
  fetchApiKeys,
  fetchWebhooks,
  fetchWebhookDeliveries,
  revokeApiKey,
  updateWebhook,
  type ApiKeyRow,
  type WebhookDeliveryRow,
  type WebhookEndpointRow,
} from "@/lib/api";

type Tab = "keys" | "webhooks";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "keys", label: "API keys" },
  { key: "webhooks", label: "Webhooks" },
];

export default function DevelopersPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("keys");

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyDialog, setKeyDialog] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>([]);
  const [keySaving, setKeySaving] = useState(false);
  const [keyFormError, setKeyFormError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState<WebhookEndpointRow[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loadingHooks, setLoadingHooks] = useState(true);
  const [hookError, setHookError] = useState<string | null>(null);
  const [hookDialog, setHookDialog] = useState(false);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [hookSaving, setHookSaving] = useState(false);
  const [hookFormError, setHookFormError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [deliveryEndpoint, setDeliveryEndpoint] = useState<WebhookEndpointRow | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRow[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    setKeyError(null);
    const result = await fetchApiKeys();
    if (result.data) {
      setKeys(result.data.keys);
      setScopes(result.data.scopes);
    }
    if (result.error) setKeyError(result.error);
    setLoadingKeys(false);
  }, []);

  const loadHooks = useCallback(async () => {
    setLoadingHooks(true);
    setHookError(null);
    const result = await fetchWebhooks();
    if (result.data) {
      setWebhooks(result.data.endpoints);
      setEvents(result.data.events);
    }
    if (result.error) setHookError(result.error);
    setLoadingHooks(false);
  }, []);

  useEffect(() => {
    void loadKeys();
    void loadHooks();
  }, [loadKeys, loadHooks]);

  const loadDeliveries = useCallback(async (endpointId: string) => {
    setLoadingDeliveries(true);
    const result = await fetchWebhookDeliveries(endpointId);
    if (result.data) setDeliveries(result.data.deliveries);
    setLoadingDeliveries(false);
  }, []);

  useEffect(() => {
    if (deliveryEndpoint) void loadDeliveries(deliveryEndpoint.id);
  }, [deliveryEndpoint, loadDeliveries]);

  const createKey = async () => {
    if (!keyName.trim()) {
      setKeyFormError("Give the key a name.");
      return;
    }
    setKeyFormError(null);
    setKeySaving(true);
    const result = await createApiKey({ name: keyName.trim(), scopes: keyScopes });
    setKeySaving(false);
    if (!result.data) {
      setKeyFormError(result.error ?? "That key could not be created.");
      return;
    }
    setRevealedKey(result.data.rawKey);
    setKeyDialog(false);
    setKeyName("");
    setKeyScopes([]);
    toast.push({ tone: "success", title: "API key created" });
    await loadKeys();
  };

  const revokeKey = async (key: ApiKeyRow) => {
    setRevoking(key.id);
    const result = await revokeApiKey(key.id);
    setRevoking(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Key could not be revoked", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "API key revoked" });
    await loadKeys();
  };

  const createHook = async () => {
    if (!hookUrl.trim()) {
      setHookFormError("Enter a URL.");
      return;
    }
    setHookFormError(null);
    setHookSaving(true);
    const result = await createWebhook({ url: hookUrl.trim(), events: hookEvents });
    setHookSaving(false);
    if (!result.data) {
      setHookFormError(result.error ?? "That webhook could not be created.");
      return;
    }
    setRevealedSecret(result.data.secret);
    setHookDialog(false);
    setHookUrl("");
    setHookEvents([]);
    toast.push({ tone: "success", title: "Webhook created" });
    await loadHooks();
  };

  const toggleHook = async (hook: WebhookEndpointRow) => {
    const result = await updateWebhook(hook.id, { active: !hook.active });
    if (result.error) {
      toast.push({ tone: "error", title: "Webhook could not be updated", description: result.error });
      return;
    }
    await loadHooks();
  };

  const removeHook = async (hook: WebhookEndpointRow) => {
    if (!window.confirm(`Delete the webhook for ${hook.url}?`)) return;
    const result = await deleteWebhook(hook.id);
    if (result.error) {
      toast.push({ tone: "error", title: "Webhook could not be deleted", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Webhook deleted" });
    await loadHooks();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Developers</h2>
        <p className="text-sm text-text-muted">
          Programmatic access to your workspace. Keys are shown once at creation and never again.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors ${
              tab === option.key ? "bg-accent text-on-accent" : "bg-surface-2 text-text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === "keys" ? (
        <div className="grid gap-4">
          {keyError ? (
            <Banner
              tone="danger"
              title="API keys could not be loaded"
              action={
                <Button variant="secondary" size="sm" onClick={loadKeys}>
                  Retry
                </Button>
              }
            >
              {keyError}
            </Banner>
          ) : null}

          {revealedKey ? (
            <Banner tone="success" title="Copy this key now — it will not be shown again">
              <span className="mono break-all text-xs">{revealedKey}</span>
            </Banner>
          ) : null}

          <Card>
            <CardHeader
              title="API keys"
              description="Scoped keys for scripts and integrations."
              actions={
                <Button size="sm" onClick={() => setKeyDialog(true)}>
                  Create key
                </Button>
              }
            />
            {loadingKeys ? (
              <div className="grid gap-2 p-4">
                <Skeleton className="h-16" rounded="lg" />
                <Skeleton className="h-16" rounded="lg" />
              </div>
            ) : keys.length === 0 ? (
              <EmptyState
                title="No API keys yet"
                description="Create a scoped key to access Click from a script or another service."
                action={
                  <Button size="sm" onClick={() => setKeyDialog(true)}>
                    Create key
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {keys.map((key) => (
                  <li key={key.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text">{key.name}</p>
                        {key.revokedAt ? (
                          <Badge tone="danger">Revoked</Badge>
                        ) : (
                          <Badge tone="success">Active</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 mono text-xs text-text-muted">{key.prefix}…</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {key.scopes.length ? key.scopes.join(", ") : "No scopes"}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Created by {key.createdByName} on {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt
                          ? ` · last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                          : " · never used"}
                      </p>
                    </div>
                    {!key.revokedAt ? (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={revoking === key.id}
                        onClick={() => void revokeKey(key)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid gap-4">
          {hookError ? (
            <Banner
              tone="danger"
              title="Webhooks could not be loaded"
              action={
                <Button variant="secondary" size="sm" onClick={loadHooks}>
                  Retry
                </Button>
              }
            >
              {hookError}
            </Banner>
          ) : null}

          {revealedSecret ? (
            <Banner tone="success" title="Copy this signing secret now — it will not be shown again">
              <span className="mono break-all text-xs">{revealedSecret}</span>
            </Banner>
          ) : null}

          <Card>
            <CardHeader
              title="Webhook endpoints"
              description="Receive signed events when something happens in your workspace."
              actions={
                <Button size="sm" onClick={() => setHookDialog(true)}>
                  Add endpoint
                </Button>
              }
            />
            {loadingHooks ? (
              <div className="grid gap-2 p-4">
                <Skeleton className="h-16" rounded="lg" />
                <Skeleton className="h-16" rounded="lg" />
              </div>
            ) : webhooks.length === 0 ? (
              <EmptyState
                title="No webhooks yet"
                description="Add an HTTPS endpoint to receive signed events."
                action={
                  <Button size="sm" onClick={() => setHookDialog(true)}>
                    Add endpoint
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {webhooks.map((hook) => (
                  <li key={hook.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="break-all text-sm font-semibold text-text">{hook.url}</p>
                        {hook.active ? (
                          <Badge tone="success">Active</Badge>
                        ) : (
                          <Badge tone="neutral">Paused</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {hook.events.length ? hook.events.join(", ") : "No events selected"}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Created {new Date(hook.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setDeliveryEndpoint(hook)}>
                        Deliveries
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void toggleHook(hook)}
                      >
                        {hook.active ? "Pause" : "Resume"}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => void removeHook(hook)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Dialog open={keyDialog} onClose={() => setKeyDialog(false)} title="Create API key">
        <div className="grid gap-3">
          <Field label="Name" htmlFor="key-name">
            <Input
              id="key-name"
              value={keyName}
              maxLength={120}
              placeholder="CI pipeline"
              onChange={(event) => setKeyName(event.target.value)}
            />
          </Field>
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-text">Scopes</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {scopes.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-accent)]"
                    checked={keyScopes.includes(scope)}
                    onChange={(event) => {
                      setKeyScopes((prev) =>
                        event.target.checked
                          ? [...prev, scope]
                          : prev.filter((entry) => entry !== scope),
                      );
                    }}
                  />
                  <span className="mono text-xs">{scope}</span>
                </label>
              ))}
            </div>
          </div>
          {keyFormError ? <p className="text-xs text-danger">{keyFormError}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setKeyDialog(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={keySaving} onClick={() => void createKey()}>
            Create key
          </Button>
        </div>
      </Dialog>

      <Dialog open={hookDialog} onClose={() => setHookDialog(false)} title="Add webhook endpoint">
        <div className="grid gap-3">
          <Field label="Endpoint URL" htmlFor="hook-url">
            <Input
              id="hook-url"
              type="url"
              value={hookUrl}
              maxLength={2000}
              placeholder="https://example.com/hooks/click"
              onChange={(event) => setHookUrl(event.target.value)}
            />
          </Field>
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-text">Events</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {events.map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-accent)]"
                    checked={hookEvents.includes(event)}
                    onChange={(eventTarget) => {
                      setHookEvents((prev) =>
                        eventTarget.target.checked
                          ? [...prev, event]
                          : prev.filter((entry) => entry !== event),
                      );
                    }}
                  />
                  <span className="mono text-xs">{event}</span>
                </label>
              ))}
            </div>
          </div>
          {hookFormError ? <p className="text-xs text-danger">{hookFormError}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setHookDialog(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={hookSaving} onClick={() => void createHook()}>
            Add endpoint
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={deliveryEndpoint !== null}
        onClose={() => setDeliveryEndpoint(null)}
        title={deliveryEndpoint ? `Deliveries · ${deliveryEndpoint.url}` : "Deliveries"}
        size="lg"
      >
        {loadingDeliveries ? (
          <div className="grid gap-2">
            <Skeleton className="h-12" rounded="lg" />
            <Skeleton className="h-12" rounded="lg" />
          </div>
        ) : deliveries.length === 0 ? (
          <EmptyState
            title="No deliveries yet"
            description="Events will appear here once your endpoint starts receiving them."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted">
                  <th className="pb-2 pr-3">Event</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Attempts</th>
                  <th className="pb-2 pr-3">Response</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-t border-border">
                    <td className="py-2 pr-3 mono text-xs text-text">{delivery.event}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        tone={
                          delivery.status === "delivered"
                            ? "success"
                            : delivery.status === "failed"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {delivery.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{delivery.attempts}</td>
                    <td className="py-2 pr-3 text-text-muted">
                      {delivery.responseCode ?? "—"}
                    </td>
                    <td className="py-2 text-text-muted">
                      {new Date(delivery.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>
    </div>
  );
}
