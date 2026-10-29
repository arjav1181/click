import { and, eq, inArray } from "drizzle-orm";
import { withAuth, withTenant, type TenantContext } from "../client";
import { botJobs, meetings } from "../schema";

export async function findBotJob(id: string) {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({
        id: botJobs.id,
        orgId: botJobs.orgId,
        meetingId: botJobs.meetingId,
        provider: botJobs.provider,
        state: botJobs.state,
        meetingUrl: botJobs.meetingUrl,
      })
      .from(botJobs)
      .where(eq(botJobs.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function updateBotJobState(
  job: { id: string; orgId: string; meetingId: string },
  input: {
    state: "queued" | "joining" | "lobby" | "active" | "completed" | "failed" | "cancelled";
    detail?: string | null;
    startedAt?: Date | null;
    endedAt?: Date | null;
  },
) {
  return withTenant({ orgId: job.orgId, userId: "00000000-0000-0000-0000-000000000000" }, async (tx) => {
    await tx
      .update(botJobs)
      .set({
        state: input.state,
        lobbyReason: input.state === "lobby" ? (input.detail ?? null) : null,
        errorCode: input.state === "failed" ? (input.detail ?? null) : null,
        startedAt: input.startedAt ?? undefined,
        endedAt: input.endedAt ?? undefined,
      })
      .where(eq(botJobs.id, job.id));

    const meetingStatus =
      input.state === "joining" || input.state === "lobby" || input.state === "active"
        ? "live"
        : input.state === "failed"
          ? "failed"
          : undefined;
    if (meetingStatus) {
      await tx
        .update(meetings)
        .set({ status: meetingStatus, ...(input.state === "active" ? { startedAt: new Date() } : {}) })
        .where(eq(meetings.id, job.meetingId));
    }
  });
}
