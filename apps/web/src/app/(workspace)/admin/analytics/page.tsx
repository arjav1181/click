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
import { fetchMembers, fetchUsage } from "@/lib/api";
import type { UsageSummary } from "@click/core";

export default function AnalyticsPage() {
  const toast = useToast();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [usageResult, memberResult] = await Promise.all([fetchUsage(), fetchMembers()]);
    if (usageResult.data) setUsage(usageResult.data.usage);
    if (memberResult.data) setMemberCount(memberResult.data.members.length);
    const message = usageResult.error ?? memberResult.error;
    if (message) setError(message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Analytics</h2>
        <p className="text-sm text-text-muted">
          Adoption and usage for this workspace. Owners and admins only.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Analytics could not be loaded"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" rounded="lg" />
          <Skeleton className="h-28" rounded="lg" />
          <Skeleton className="h-28" rounded="lg" />
          <Skeleton className="h-28" rounded="lg" />
        </div>
      ) : !usage ? (
        <Card>
          <EmptyState title="No usage data yet" description="Usage appears here once meetings are processed." />
        </Card>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Members" value={String(memberCount)} />
            <StatCard label="ASR seconds" value={usage.asrSeconds.toLocaleString()} />
            <StatCard label="LLM tokens in" value={usage.llmTokensIn.toLocaleString()} />
            <StatCard label="LLM tokens out" value={usage.llmTokensOut.toLocaleString()} />
          </div>

          <Card>
            <CardHeader title="Cost" description="Estimated spend for the current period." />
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-text-muted">Cost estimate</p>
                <p className="text-2xl font-semibold text-text">
                  {usage.costEstimate.toFixed(2)} {usage.currency}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Budget cap</p>
                <p className="text-2xl font-semibold text-text">
                  {usage.budgetCap > 0 ? `${usage.budgetCap.toFixed(2)} ${usage.currency}` : "No cap"}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Period</p>
                <p className="text-sm font-medium text-text">
                  {usage.periodStart ? new Date(usage.periodStart).toLocaleDateString() : "—"}
                  {usage.periodEnd ? ` → ${new Date(usage.periodEnd).toLocaleDateString()}` : ""}
                </p>
              </div>
            </div>
          </Card>

          {usage.budgetCap > 0 && usage.costEstimate >= usage.budgetCap * 0.8 ? (
            <Banner tone="warning" title="Approaching budget cap">
              Spend is at {((usage.costEstimate / usage.budgetCap) * 100).toFixed(0)}% of the monthly cap.
            </Banner>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
    </Card>
  );
}
