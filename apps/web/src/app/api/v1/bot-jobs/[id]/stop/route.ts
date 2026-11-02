import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { botJobs, botsRepo, withTenant } from "@click/db";
import { requestBotStop } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  reason: z.string().trim().max(200).optional(),
});

/** Stops one bot job from the console. Active audio is still finalized. */
export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;
  const body = await parseJson(request, schema).catch(() => ({ reason: undefined }));

  const job = await botsRepo.getBotJob({ orgId: session.orgId, userId: session.id }, id);
  if (!job) throw new ApiError(404, "not_found", "Bot job not found.");
  if (!["queued", "joining", "lobby", "active"].includes(job.state)) {
    throw new ApiError(409, "bot_terminal", "That bot job has already finished.");
  }

  const stopped = await requestBotStop(job.id);
  if (!stopped.ok) {
    await withTenant({ orgId: session.orgId, userId: session.id }, async (tx) => {
      await tx
        .update(botJobs)
        .set({ state: "cancelled", endedAt: new Date() })
        .where(and(eq(botJobs.id, job.id), inArray(botJobs.state, ["queued", "joining", "lobby", "active"])));
    });
  }

  await recordAudit(session, {
    action: "bot.cancelled",
    targetType: "bot_job",
    targetId: job.id,
    metadata: { meetingId: job.meetingId, reason: body.reason ?? null, runnerAccepted: stopped.ok },
    ip: clientIp(request),
  });
  return json({ ok: true, runnerAccepted: stopped.ok }, { status: 202 });
});
