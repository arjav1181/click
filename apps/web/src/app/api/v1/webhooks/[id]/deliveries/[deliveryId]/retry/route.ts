import { developersRepo } from "@click/db";
import { retryWebhookDelivery } from "@click/backend";
import { assertSameOrigin, handler, json, ApiError, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const POST = handler(
  async (request, context: { params: Promise<{ id: string; deliveryId: string }> }) => {
    assertSameOrigin(request);
    const session = await requireOrgSession();
    requireRole(session, ["owner", "admin"]);
    const { id, deliveryId } = await context.params;

    const delivery = await developersRepo.getWebhookDelivery(
      { orgId: session.orgId, userId: session.id },
      deliveryId,
    );
    if (!delivery || delivery.endpointId !== id) {
      throw new ApiError(404, "not_found", "That delivery does not exist.");
    }

    const ok = await retryWebhookDelivery(session.orgId, deliveryId);
    if (!ok) throw new ApiError(404, "not_found", "That delivery does not exist.");

    await recordAudit(session, {
      action: "webhook.delivery_retried",
      targetType: "webhook_delivery",
      targetId: deliveryId,
      metadata: { endpointId: id, event: delivery.event },
      ip: clientIp(request),
    });
    return json({ ok: true });
  },
);
