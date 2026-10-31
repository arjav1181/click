/**
 * Outgoing webhooks.
 *
 * A workspace subscribes to events with a URL. Click then posts the event as
 * JSON, signed with the endpoint's secret so the receiver can prove the
 * request came from this instance:
 *
 *   Click-Signature: sha256=<hmac of "<timestamp>.<body>">
 *   Click-Timestamp: <unix seconds>
 *
 * Every attempt is stored as a delivery row so the workspace can see what was
 * sent, what came back and when the next retry happens.
 */
import { createHmac, randomUUID } from "node:crypto";
import { developersRepo } from "@click/db";
import { decryptSecret } from "./crypto";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

/** Deliveries are attempted this many times before they are given up on. */
export const MAX_DELIVERY_ATTEMPTS = 5;

/** Backoff before each retry. The last entry is repeated if more are needed. */
const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000];

export interface WebhookDeliveryResult {
  status: "delivered" | "failed" | "exhausted";
  responseCode: number | null;
  attempts: number;
  nextRetryAt: string | null;
  error?: string;
}

/** Signs the exact bytes that are sent, together with the timestamp. */
export function signWebhookBody(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function retryDelayMs(attempts: number): number {
  const index = Math.max(0, Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1));
  return RETRY_DELAYS_MS[index];
}

/**
 * Sends one event to every active endpoint in the workspace that subscribes
 * to it. Failures are recorded, never thrown: a broken endpoint must not stop
 * the meeting pipeline.
 */
export async function emitWebhookEvent(
  orgId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<string[]> {
  try {
    return await queueWebhookEvent(orgId, event, data);
  } catch (error) {
    console.error(`[webhook] ${event} could not be queued`, error);
    return [];
  }
}

async function queueWebhookEvent(
  orgId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<string[]> {
  const ctx = { orgId, userId: SYSTEM_USER };
  const endpoints = await developersRepo.listWebhookEndpointsForEvent(ctx, event);
  if (endpoints.length === 0) return [];

  const { enqueue } = await import("./queue");
  const body = { event, createdAt: new Date().toISOString(), data };
  const ids: string[] = [];
  for (const endpoint of endpoints) {
    const delivery = await developersRepo.createWebhookDelivery(ctx, {
      endpointId: endpoint.id,
      eventId: randomUUID(),
      event,
      payload: body,
    });
    if (!delivery) continue;
    ids.push(delivery.id);
    await enqueue("webhook", { orgId, deliveryId: delivery.id });
  }
  return ids;
}

/**
 * Delivers one event to one endpoint and records the result. A failed
 * delivery is retried with backoff until `MAX_DELIVERY_ATTEMPTS`.
 */
export async function deliverWebhook(
  orgId: string,
  deliveryId: string,
): Promise<WebhookDeliveryResult> {
  const ctx = { orgId, userId: SYSTEM_USER };
  const delivery = await developersRepo.getWebhookDelivery(ctx, deliveryId);
  if (!delivery) {
    return { status: "exhausted", responseCode: null, attempts: 0, nextRetryAt: null, error: "not_found" };
  }
  if (delivery.status === "delivered") {
    return {
      status: "delivered",
      responseCode: delivery.responseCode,
      attempts: delivery.attempts,
      nextRetryAt: null,
    };
  }

  const endpoint = await developersRepo.getWebhookEndpoint(ctx, delivery.endpointId);
  if (!endpoint || !endpoint.active) {
    await developersRepo.updateWebhookDelivery(ctx, delivery.id, {
      status: "exhausted",
      nextRetryAt: null,
    });
    return {
      status: "exhausted",
      responseCode: delivery.responseCode,
      attempts: delivery.attempts,
      nextRetryAt: null,
      error: "endpoint_inactive",
    };
  }
  if (!endpoint.secretEnc) {
    await developersRepo.updateWebhookDelivery(ctx, delivery.id, {
      status: "exhausted",
      attempts: delivery.attempts + 1,
      nextRetryAt: null,
    });
    return {
      status: "exhausted",
      responseCode: delivery.responseCode,
      attempts: delivery.attempts + 1,
      nextRetryAt: null,
      error: "missing_signing_secret",
    };
  }

  let secret: string;
  try {
    secret = decryptSecret(endpoint.secretEnc);
  } catch {
    await developersRepo.updateWebhookDelivery(ctx, delivery.id, {
      status: "exhausted",
      attempts: delivery.attempts + 1,
      nextRetryAt: null,
    });
    return {
      status: "exhausted",
      responseCode: delivery.responseCode,
      attempts: delivery.attempts + 1,
      nextRetryAt: null,
      error: "unreadable_signing_secret",
    };
  }

  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const attempts = delivery.attempts + 1;
  let responseCode: number | null = null;
  let error: string | undefined;

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Click-Webhooks/1.0",
        "Click-Event": delivery.event,
        "Click-Delivery": delivery.id,
        "Click-Timestamp": String(timestamp),
        "Click-Signature": `sha256=${signWebhookBody(secret, timestamp, body)}`,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    responseCode = response.status;
    if (response.status < 200 || response.status >= 300) {
      error = `endpoint_returned_${response.status}`;
    }
  } catch (cause) {
    error = `endpoint_unreachable: ${cause instanceof Error ? cause.message : "unknown"}`;
  }

  if (!error) {
    await developersRepo.updateWebhookDelivery(ctx, delivery.id, {
      status: "delivered",
      attempts,
      responseCode,
      nextRetryAt: null,
    });
    return { status: "delivered", responseCode, attempts, nextRetryAt: null };
  }

  if (attempts >= MAX_DELIVERY_ATTEMPTS) {
    await developersRepo.updateWebhookDelivery(ctx, delivery.id, {
      status: "exhausted",
      attempts,
      responseCode,
      nextRetryAt: null,
    });
    return { status: "exhausted", responseCode, attempts, nextRetryAt: null, error };
  }

  const delay = retryDelayMs(attempts);
  const nextRetryAt = new Date(Date.now() + delay);
  await developersRepo.updateWebhookDelivery(ctx, delivery.id, {
    status: "pending",
    attempts,
    responseCode,
    nextRetryAt,
  });
  const { enqueue } = await import("./queue");
  await enqueue("webhook", { orgId, deliveryId: delivery.id }, { delayMs: delay });
  return {
    status: "failed",
    responseCode,
    attempts,
    nextRetryAt: nextRetryAt.toISOString(),
    error,
  };
}

/** Puts a failed delivery back in the queue by hand. */
export async function retryWebhookDelivery(orgId: string, deliveryId: string): Promise<boolean> {
  const ctx = { orgId, userId: SYSTEM_USER };
  const delivery = await developersRepo.getWebhookDelivery(ctx, deliveryId);
  if (!delivery) return false;
  await developersRepo.updateWebhookDelivery(ctx, delivery.id, {
    status: "pending",
    // A manual retry starts a fresh cycle; the old attempt count would
    // otherwise exhaust the delivery before it is even sent.
    attempts: 0,
    nextRetryAt: null,
  });
  const { enqueue } = await import("./queue");
  await enqueue("webhook", { orgId, deliveryId: delivery.id });
  return true;
}
