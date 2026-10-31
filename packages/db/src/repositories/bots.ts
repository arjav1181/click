import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { withAuth, withTenant, type TenantContext } from "../client";
import { botJobs, meetings } from "../schema";

export interface BotJobRow {
  id: string;
  meetingId: string;
  meetingTitle: string;
  provider: string;
  meetingUrl: string;
  botName: string;
  state: string;
  attempts: number;
  lobbyReason: string | null;
  errorCode: string | null;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export async function listBotJobs(ctx: TenantContext): Promise<BotJobRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: botJobs.id,
        meetingId: botJobs.meetingId,
        meetingTitle: sql<string>`coalesce((select m.title from meetings m where m.id = ${botJobs.meetingId}), 'Meeting')`,
        provider: botJobs.provider,
        meetingUrl: botJobs.meetingUrl,
        botName: botJobs.botName,
        state: botJobs.state,
        attempts: botJobs.attempts,
        lobbyReason: botJobs.lobbyReason,
        errorCode: botJobs.errorCode,
        scheduledAt: botJobs.scheduledAt,
        startedAt: botJobs.startedAt,
        endedAt: botJobs.endedAt,
        createdAt: botJobs.createdAt,
      })
      .from(botJobs)
      .where(eq(botJobs.orgId, ctx.orgId))
      .orderBy(desc(botJobs.createdAt));
    return rows.map((row) => ({
      id: row.id,
      meetingId: row.meetingId,
      meetingTitle: row.meetingTitle,
      provider: row.provider,
      meetingUrl: row.meetingUrl,
      botName: row.botName,
      state: row.state,
      attempts: row.attempts,
      lobbyReason: row.lobbyReason,
      errorCode: row.errorCode,
      scheduledAt: row.scheduledAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      endedAt: row.endedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function createBotJob(
  ctx: TenantContext,
  input: {
    meetingId: string;
    provider: "zoom" | "teams" | "meet" | "webex" | "jitsi";
    meetingUrl: string;
    botName?: string;
    calendarEventId?: string | null;
    idempotencyKey: string;
    scheduledAt?: Date;
  },
): Promise<{ id: string; state: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(botJobs)
      .values({
        orgId: ctx.orgId,
        meetingId: input.meetingId,
        provider: input.provider,
        meetingUrl: input.meetingUrl,
        botName: input.botName ?? "Click Notetaker",
        calendarEventId: input.calendarEventId ?? null,
        idempotencyKey: input.idempotencyKey,
        scheduledAt: input.scheduledAt ?? new Date(),
      })
      .onConflictDoNothing({ target: botJobs.idempotencyKey })
      .returning({ id: botJobs.id, state: botJobs.state });
    if (rows[0]) return rows[0];
    // The key already exists: a sync or a retry created this job before.
    const existing = await tx
      .select({ id: botJobs.id, state: botJobs.state })
      .from(botJobs)
      .where(eq(botJobs.idempotencyKey, input.idempotencyKey))
      .limit(1);
    return existing[0] ?? { id: input.meetingId, state: "queued" };
  });
}

export async function getBotJob(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: botJobs.id,
        orgId: botJobs.orgId,
        meetingId: botJobs.meetingId,
        provider: botJobs.provider,
        state: botJobs.state,
        meetingUrl: botJobs.meetingUrl,
        botName: botJobs.botName,
        calendarEventId: botJobs.calendarEventId,
        providerConfig: botJobs.providerConfig,
        attempts: botJobs.attempts,
        errorCode: botJobs.errorCode,
        lobbyReason: botJobs.lobbyReason,
        scheduledAt: botJobs.scheduledAt,
        startedAt: botJobs.startedAt,
        endedAt: botJobs.endedAt,
      })
      .from(botJobs)
      .where(and(eq(botJobs.id, id), eq(botJobs.orgId, ctx.orgId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      orgId: row.orgId,
      meetingId: row.meetingId,
      provider: row.provider as BotJobRow["provider"],
      state: row.state as BotJobRow["state"],
      meetingUrl: row.meetingUrl,
      botName: row.botName,
      calendarEventId: row.calendarEventId,
      providerConfig: (row.providerConfig ?? {}) as Record<string, unknown>,
      attempts: row.attempts,
      errorCode: row.errorCode,
      lobbyReason: row.lobbyReason,
      scheduledAt: row.scheduledAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      endedAt: row.endedAt?.toISOString() ?? null,
    };
  });
}

/** Marks a job as failed and records why, so the console can explain it. */
export async function failBotJob(ctx: TenantContext, id: string, code: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx
      .update(botJobs)
      .set({ state: "failed", errorCode: code, updatedAt: new Date() })
      .where(and(eq(botJobs.id, id), eq(botJobs.orgId, ctx.orgId)));
  });
}

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
