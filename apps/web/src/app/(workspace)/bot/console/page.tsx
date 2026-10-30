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
import { fetchBotJobs, type BotJobRow } from "@/lib/api";

export default function BotConsolePage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<BotJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchBotJobs();
    if (result.data) setJobs(result.data.jobs);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Bot console</h2>
          <p className="text-sm text-text-muted">
            Operate the bot fleet: queued, joining, in-call and failed jobs.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Bot jobs could not be loaded"
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
          <Skeleton className="h-20" rounded="lg" />
          <Skeleton className="h-20" rounded="lg" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <EmptyState
            title="No bot jobs"
            description="Bot jobs appear here when a bot is sent to a meeting."
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader
                title={job.meetingTitle}
                description={`${job.provider} · ${job.botName}`}
                actions={
                  <Badge
                    tone={
                      job.state === "completed"
                        ? "success"
                        : job.state === "failed" || job.state === "cancelled"
                          ? "danger"
                          : "accent"
                    }
                  >
                    {job.state}
                  </Badge>
                }
              />
              <div className="grid gap-1 p-4 text-xs text-text-muted">
                <p className="truncate">{job.meetingUrl}</p>
                <p>
                  Scheduled {new Date(job.scheduledAt).toLocaleString()}
                  {job.startedAt ? ` · started ${new Date(job.startedAt).toLocaleString()}` : ""}
                  {job.endedAt ? ` · ended ${new Date(job.endedAt).toLocaleString()}` : ""}
                </p>
                {job.lobbyReason ? <p>Lobby: {job.lobbyReason}</p> : null}
                {job.errorCode ? <p className="text-danger">Error: {job.errorCode}</p> : null}
                <p>Attempts: {job.attempts}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
