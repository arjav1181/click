import { z } from "zod";
import { fetchBotRunnerStatus, requestBotCircuitReset } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

/** Runner health: configured or not, plus the provider circuit state. */
export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const runner = await fetchBotRunnerStatus();
  return json({ runner });
});

const schema = z.object({
  provider: z.enum(["meet", "jitsi", "zoom", "teams", "webex"]),
});

/** Clears a provider circuit breaker after the operator fixed the cause. */
export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, schema);

  const result = await requestBotCircuitReset(body.provider);
  if (!result.ok) {
    throw new ApiError(503, "bot_service_unavailable", result.error ?? "The bot runner is not reachable.");
  }
  await recordAudit(session, {
    action: "bot.circuit_reset",
    targetType: "provider",
    targetId: body.provider,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true, provider: body.provider });
});
