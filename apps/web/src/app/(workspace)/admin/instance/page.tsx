"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
  useToast,
} from "@click/ui";

interface ProviderRow {
  kind: string;
  provider: string;
  model: string | null;
  configured: boolean;
  endpoint: string | null;
  key: string;
  dimensions?: number;
}

interface ProvidersPayload {
  providers: ProviderRow[];
  pricing: unknown;
}

export default function InstanceOpsPage() {
  const toast = useToast();
  const [data, setData] = useState<ProvidersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message?: string; status?: number }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/providers");
      const payload = (await response.json().catch(() => ({}))) as ProvidersPayload & { error?: { message?: string } };
      if (!response.ok) {
        setError(payload.error?.message ?? "Instance config could not be loaded.");
      } else {
        setData(payload);
      }
    } catch {
      setError("We could not reach the server.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const test = async (kind: string) => {
    setTesting(kind);
    try {
      const response = await fetch("/api/v1/admin/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; status?: number };
      setResults((prev) => ({
        ...prev,
        [kind]: { ok: Boolean(payload.ok), message: payload.message, status: payload.status },
      }));
    } catch {
      setResults((prev) => ({ ...prev, [kind]: { ok: false, message: "Request failed" } }));
    }
    setTesting(null);
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Instance ops</h2>
        <p className="text-sm text-text-muted">
          SMTP, storage, SSO and provider configuration. These are read from the environment; change them in
          your deployment config and restart.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Instance config could not be loaded"
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
          <Skeleton className="h-24" rounded="lg" />
        </div>
      ) : !data ? (
        <Card>
          <EmptyState title="No config available" />
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.providers.map((provider) => (
            <Card key={provider.kind}>
              <CardHeader
                title={provider.kind.toUpperCase()}
                description={provider.provider}
                actions={
                  <Badge tone={provider.configured ? "success" : "danger"}>
                    {provider.configured ? "Configured" : "Not configured"}
                  </Badge>
                }
              />
              <div className="grid gap-2 p-4 text-sm">
                {provider.model ? (
                  <p className="text-text-muted">
                    Model: <span className="text-text">{provider.model}</span>
                  </p>
                ) : null}
                {provider.endpoint ? (
                  <p className="text-text-muted">
                    Endpoint: <span className="mono text-text">{provider.endpoint}</span>
                  </p>
                ) : null}
                {provider.key ? (
                  <p className="text-text-muted">
                    Key: <span className="mono text-text">{provider.key}</span>
                  </p>
                ) : null}
                {provider.dimensions ? (
                  <p className="text-text-muted">
                    Dimensions: <span className="text-text">{provider.dimensions}</span>
                  </p>
                ) : null}
                {results[provider.kind] ? (
                  <Banner
                    tone={results[provider.kind].ok ? "success" : "danger"}
                    title={results[provider.kind].ok ? "Test passed" : "Test failed"}
                  >
                    {results[provider.kind].message ?? `HTTP ${results[provider.kind].status}`}
                  </Banner>
                ) : null}
                <div className="pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={testing === provider.kind}
                    onClick={() => void test(provider.kind)}
                  >
                    Test connection
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
