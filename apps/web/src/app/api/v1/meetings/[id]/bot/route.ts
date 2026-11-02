import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { botJobs, meetings, workspaceRepo, withTenant } from "@click/db";
import { enqueue, isBotServiceConfigured } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  provider: z.enum(["zoom", "teams", "meet", "webex", "jitsi"]),
  meetingUrl: z.string().url().max(2000),
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  if (!isBotServiceConfigured()) {
    throw new ApiError(
      503,
      "bot_service_not_configured",
      "No bot runner is configured. Set BOT_SERVICE_URL to enable bot joins.",
    );
  }
  const policy = await workspaceRepo.getRecordingPolicy({ orgId: session.orgId, userId: session.id });
  if (!policy.browserBotEnabled) {
    throw new ApiError(
      409,
      "browser_bot_disabled",
      "Browser-bot joins are disabled for this workspace. Enable them in Recording policy.",
    );
  }

  const host = new URL(body.meetingUrl).hostname.toLowerCase();
  const allowedHosts: Record<string, string[]> = {
    zoom: ["zoom.us", "zoomgov.com"],
    teams: ["teams.microsoft.com", "teams.live.com"],
    meet: ["meet.google.com"],
    webex: ["webex.com"],
    jitsi: ["meet.jit.si"],
  };
  if (!allowedHosts[body.provider].some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    throw new ApiError(422, "host_mismatch", `That link does not look like a ${body.provider} meeting.`);
  }

  const job = await withTenant({ orgId: session.orgId, userId: session.id }, async (tx) => {
    const meeting = await tx
      .select({ id: meetings.id })
      .from(meetings)
      .where(and(eq(meetings.id, id), isNull(meetings.deletedAt)))
      .limit(1);
    if (!meeting[0]) throw new ApiError(404, "not_found", "Meeting not found.");

    const active = await tx
      .select({ id: botJobs.id })
      .from(botJobs)
      .where(and(eq(botJobs.meetingId, id), inArray(botJobs.state, ["queued", "joining", "lobby", "active"])))
      .limit(1);
    if (active[0]) throw new ApiError(409, "bot_active", "A bot is already assigned to this meeting.");

    const rows = await tx
      .insert(botJobs)
      .values({
        orgId: session.orgId,
        meetingId: id,
        provider: body.provider,
        meetingUrl: body.meetingUrl,
        idempotencyKey: `manual:${session.orgId}:${id}:${Date.now()}`,
      })
      .returning({ id: botJobs.id, state: botJobs.state });
    return rows[0];
  });

  await recordAudit(session, {
    action: "bot.queued",
    targetType: "bot_job",
    targetId: job.id,
    metadata: { meetingId: id, provider: body.provider },
    ip: clientIp(request),
  });
  // The row is only a record; the queue is what actually asks the runner to
  // join. Without this the job stayed in `queued` forever.
  await enqueue("bot", { orgId: session.orgId, botJobId: job.id });
  return json({ bot: job }, { status: 202 });
});

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const { requestBotStop } = await import("@click/backend");
  const active = await withTenant({ orgId: session.orgId, userId: session.id }, async (tx) => {
    return tx
      .select({ id: botJobs.id })
      .from(botJobs)
      .where(and(eq(botJobs.meetingId, id), inArray(botJobs.state, ["queued", "joining", "lobby", "active"])));
  });
  if (active.length === 0) throw new ApiError(404, "no_active_bot", "No bot is assigned to this meeting.");

  // Ask the runner to leave first. If it accepts, it uploads the partial
  // recording and posts its own final state; only an unreachable runner is
  // marked cancelled here.
  for (const job of active) {
    const result = await requestBotStop(job.id);
    if (!result.ok) {
      await withTenant({ orgId: session.orgId, userId: session.id }, async (tx) => {
        await tx
          .update(botJobs)
          .set({ state: "cancelled", endedAt: new Date() })
          .where(and(eq(botJobs.id, job.id), inArray(botJobs.state, ["queued", "joining", "lobby", "active"])));
      });
    }
  }
  await recordAudit(session, {
    action: "bot.cancelled",
    targetType: "meeting",
    targetId: id,
    metadata: { jobs: active.length },
    ip: clientIp(request),
  });
  return new Response(null, { status: 204 });
});
