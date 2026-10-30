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
import { fetchSkillRuns, type SkillRunRow } from "@/lib/api";

export default function FeedPage() {
  const toast = useToast();
  const [runs, setRuns] = useState<SkillRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchSkillRuns();
    if (result.data) setRuns(result.data.runs);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Feed</h2>
        <p className="text-sm text-text-muted">
          Outputs from your skills and automations.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Feed could not be loaded"
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
          <Skeleton className="h-32" rounded="lg" />
          <Skeleton className="h-32" rounded="lg" />
        </div>
      ) : runs.length === 0 ? (
        <Card>
          <EmptyState
            title="No outputs yet"
            description="Skill runs and automation results will appear here."
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {runs.map((run) => (
            <Card key={run.id}>
              <CardHeader
                title={run.skillName}
                description={new Date(run.createdAt).toLocaleString()}
                actions={
                  <Badge
                    tone={
                      run.status === "completed"
                        ? "success"
                        : run.status === "failed"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {run.status}
                  </Badge>
                }
              />
              <div className="grid gap-2 p-4">
                {run.outputMarkdown ? (
                  <p className="whitespace-pre-wrap text-sm text-text">{run.outputMarkdown}</p>
                ) : run.error ? (
                  <p className="text-sm text-danger">{run.error}</p>
                ) : (
                  <p className="text-sm text-text-muted">No output yet.</p>
                )}
                <p className="text-xs text-text-muted">
                  {run.meetingIds.length} meeting{run.meetingIds.length === 1 ? "" : "s"} ·{" "}
                  {run.tokensIn + run.tokensOut} tokens
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
