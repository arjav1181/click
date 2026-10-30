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
  connectIntegration,
  disconnectIntegration,
  fetchIntegrations,
  type IntegrationCatalogRow,
  type IntegrationConnectionRow,
} from "@/lib/api";

export default function IntegrationsPage() {
  const toast = useToast();
  const [catalog, setCatalog] = useState<IntegrationCatalogRow[]>([]);
  const [connections, setConnections] = useState<IntegrationConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [connecting, setConnecting] = useState<IntegrationCatalogRow | null>(null);
  const [configText, setConfigText] = useState("{}");
  const [configError, setConfigError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchIntegrations();
    if (result.data) {
      setCatalog(result.data.catalog);
      setConnections(result.data.connections);
    }
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set(catalog.map((item) => item.category));
    return ["all", ...Array.from(set).sort()];
  }, [catalog]);

  const connectionByKey = useMemo(() => {
    const map = new Map<string, IntegrationConnectionRow>();
    for (const connection of connections) map.set(connection.integrationKey, connection);
    return map;
  }, [connections]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (needle && !item.name.toLowerCase().includes(needle) && !item.key.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [catalog, category, query]);

  const connect = async () => {
    if (!connecting) return;
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(configText || "{}");
      if (typeof config !== "object" || Array.isArray(config)) throw new Error("not an object");
    } catch {
      setConfigError("Config must be a JSON object.");
      return;
    }
    setConfigError(null);
    setSaving(true);
    const result = await connectIntegration({ integrationKey: connecting.key, config });
    setSaving(false);
    if (result.error) {
      setConfigError(result.error);
      return;
    }
    setConnecting(null);
    setConfigText("{}");
    toast.push({ tone: "success", title: `${connecting.name} connected` });
    await load();
  };

  const disconnect = async (key: string, name: string) => {
    if (!window.confirm(`Disconnect ${name}?`)) return;
    const result = await disconnectIntegration(key);
    if (result.error) {
      toast.push({ tone: "error", title: "Could not disconnect", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: `${name} disconnected` });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Integrations</h2>
        <p className="text-sm text-text-muted">
          Connect the tools your team already uses. Credentials are stored encrypted on this instance.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Integrations could not be loaded"
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

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="int-search">
              Search
            </label>
            <Input
              id="int-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search integrations…"
            />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="int-category">
              Category
            </label>
            <select
              id="int-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-md border border-border-input bg-surface px-3 text-base text-text"
            >
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All categories" : option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            title="No integrations found"
            description="Try a different search or category."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const connection = connectionByKey.get(item.key);
            return (
              <Card key={item.key} className="flex flex-col">
                <CardHeader
                  title={item.name}
                  description={item.category}
                  actions={
                    connection ? (
                      <Badge tone={connection.status === "connected" ? "success" : "danger"}>
                        {connection.status}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Not connected</Badge>
                    )
                  }
                />
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <p className="text-xs text-text-muted">
                    {item.scopes.length ? item.scopes.join(", ") : "No scopes required"}
                  </p>
                  {connection ? (
                    <p className="text-xs text-text-muted">
                      Connected by {connection.connectedByName} on{" "}
                      {new Date(connection.connectedAt).toLocaleDateString()}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    {connection ? (
                      <Button variant="danger" size="sm" onClick={() => void disconnect(item.key, item.name)}>
                        Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setConnecting(item)}>
                        Connect
                      </Button>
                    )}
                    {item.docsUrl ? (
                      <a
                        href={item.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-text-muted hover:text-text"
                      >
                        Docs →
                      </a>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={connecting !== null}
        onClose={() => {
          setConnecting(null);
          setConfigText("{}");
          setConfigError(null);
        }}
        title={connecting ? `Connect ${connecting.name}` : "Connect"}
      >
        <div className="grid gap-3">
          <p className="text-sm text-text-muted">
            This instance stores the connection locally. For OAuth providers, complete the provider flow in
            a new tab and paste the resulting config here.
          </p>
          <Field
            label="Config (JSON)"
            htmlFor="integration-config"
            hint="Optional settings for this integration."
            error={configError ?? undefined}
          >
            <Textarea
              id="integration-config"
              rows={6}
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConnecting(null);
              setConfigText("{}");
              setConfigError(null);
            }}
          >
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => void connect()}>
            Connect
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
