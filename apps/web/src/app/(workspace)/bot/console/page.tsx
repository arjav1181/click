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
import { fetchBotJobs, fetchBotRunner, resetBotCircuit, stopBotJob, type BotJobRow } from "@/lib/api";

export default function BotConsolePage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<BotJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const [runner, setRunner] = useState<Awaited<ReturnType<typeof fetchBotRunner>>["data"]>(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchBotJobs();
    if (result.data) setJobs(result.data.jobs);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  const loadRunner = useCallback(async () => {
    const result = await fetchBotRunner();
    if (result.data) {
      setRunner(result.data);
      setRunnerError(null);
    } else {
      setRunner(null);
      setRunnerError(result.error);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadRunner();
  }, [load, loadRunner]);

  const resetCircuit = async (provider: string) => {
    setResetting(provider);
    const result = await resetBotCircuit(provider);
    setResetting(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Could not reset the circuit", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: `Circuit reset for ${provider}` });
    await loadRunner();
  };

  const stop = async (job: BotJobRow) => {
    if (!window.confirm(`Stop the bot in ${job.meetingTitle}? It will still upload the audio it captured.`)) {
      return;
    }
    setStopping(job.id);
    const result = await stopBotJob(job.id);
    setStopping(null);
    if (result.error) {
      toast.push({ tone: "error", title: "Could not stop the bot", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Bot stopping" });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Bot console</h2>
          <p className="text-sm text-text-muted">
            Operate the bot fleet: queued, joining, in-call and failed jobs.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void load();
            void loadRunner();
          }}
        >
          Refresh
        </Button>
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Bot runner"
          description="The service that drives Chromium to join meetings."
          actions={
            runner?.runner.ok ? (
              <Badge tone="success">online</Badge>
            ) : runner?.runner.configured ? (
              <Badge tone="danger">unreachable</Badge>
            ) : (
              <Badge tone="neutral">not configured</Badge>
            )
          }
        />
        <div className="grid gap-3 p-4">
          {runnerError ? (
            <p className="text-xs text-text-muted">{runnerError}</p>
          ) : !runner?.runner.configured ? (
            <p className="text-xs text-text-muted">
              Set <code className="mono">BOT_SERVICE_URL</code> and run the bot service to enable browser
              joins. Manual bot jobs will keep failing with a clear reason until then.
            </p>
          ) : runner?.runner.status ? (
            <>
              <p className="text-xs text-text-muted">
                {runner.runner.status.active} active · {runner.runner.status.queued} queued · max{" "}
                {runner.runner.status.maxConcurrent} concurrent
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(runner.runner.status.providers).map(([provider, health]) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm text-text">
                      {provider}
                      {health.open ? (
                        <Badge tone="danger">circuit open</Badge>
                      ) : health.failures > 0 ? (
                        <Badge tone="warning">{health.failures} failures</Badge>
                      ) : (
                        <Badge tone="success">ready</Badge>
                      )}
                    </span>
                    {health.failures > 0 ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={resetting === provider}
                        onClick={() => void resetCircuit(provider)}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-text-muted">The runner did not report its status.</p>
          )}
        </div>
      </Card>

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
                  <div className="flex items-center gap-2">
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
                    {["queued", "joining", "lobby", "active"].includes(job.state) ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={stopping === job.id}
                        onClick={() => void stop(job)}
                      >
                        Stop
                      </Button>
                    ) : null}
                  </div>
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
