import { enqueue, isCalendarProviderConfigured } from "@click/backend";
import { calendarsRepo } from "@click/db";
import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;

  const connection = await calendarsRepo.getCalendarConnection({ orgId: session.orgId, userId: session.id }, id);
  if (!connection) throw new ApiError(404, "not_found", "That connection does not exist.");
  if (!isCalendarProviderConfigured(connection.provider)) {
    throw new ApiError(
      503,
      "calendar_not_configured",
      `${connection.provider === "google" ? "GOOGLE_CLIENT_ID" : "MICROSOFT_CLIENT_ID"} is not set on this instance, so this calendar cannot be synced.`,
    );
  }
  if (connection.refreshTokenEnc === "placeholder") {
    throw new ApiError(
      409,
      "calendar_not_connected",
      "This calendar was added manually, so it has no OAuth token. Connect it with the OAuth button to sync events.",
    );
  }

  await enqueue("calendar", { orgId: session.orgId, connectionId: id });
  await recordAudit(session, {
    action: "calendar.sync_requested",
    targetType: "calendar_connection",
    targetId: id,
    metadata: { provider: connection.provider },
    ip: clientIp(request),
  });
  return json({ ok: true }, { status: 202 });
});
