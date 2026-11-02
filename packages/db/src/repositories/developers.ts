import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { withAuth, withTenant, type TenantContext } from "../client";
import { apiKeys, webhookDeliveries, webhookEndpoints } from "../schema";
import { randomToken, sha256 } from "../password";

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdByName: string;
}

export interface WebhookEndpointRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface WebhookDeliveryRow {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  nextRetryAt: string | null;
  createdAt: string;
}

const AVAILABLE_SCOPES = [
  "meetings:read",
  "meetings:write",
  "transcripts:read",
  "notes:read",
  "action-items:read",
  "search:read",
  "webhooks:manage",
  // Uploading a recording from the desktop, extension or mobile client.
  "recordings:write",
];

export function availableScopes(): string[] {
  return AVAILABLE_SCOPES;
}

export const AVAILABLE_WEBHOOK_EVENTS = [
  "meeting.created",
  "meeting.ready",
  "meeting.failed",
  "transcript.ready",
  "note.ready",
  "action_item.created",
  "action_item.updated",
];

export function availableWebhookEvents(): string[] {
  return AVAILABLE_WEBHOOK_EVENTS;
}

export interface ApiKeyAuth {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  scopes: string[];
}

/**
 * Resolves a raw `ck_…` key to its workspace.
 *
 * The lookup is by hash because only the hash is stored, and it runs as
 * `click_auth` (bypasses RLS) because the workspace is not known until the key
 * is found. `lastUsedAt` is refreshed here so the developers screen can show
 * which keys are actually in use.
 */
export async function verifyApiKey(rawKey: string): Promise<ApiKeyAuth | null> {
  const hash = sha256(rawKey);
  return withAuth(async (tx) => {
    const rows = await tx
      .select({
        id: apiKeys.id,
        orgId: apiKeys.orgId,
        userId: apiKeys.userId,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);
    const key = rows[0];
    if (!key || key.revokedAt) return null;
    await tx.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
    return {
      id: key.id,
      orgId: key.orgId,
      userId: key.userId,
      name: key.name,
      scopes: key.scopes ?? [],
    };
  });
}

export async function listApiKeys(ctx: TenantContext): Promise<ApiKeyRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
        createdByName: sql<string>`coalesce((select u.name from users u where u.id = ${apiKeys.userId}), 'Unknown')`,
      })
      .from(apiKeys)
      .where(eq(apiKeys.orgId, ctx.orgId))
      .orderBy(desc(apiKeys.createdAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes ?? [],
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      createdByName: row.createdByName,
    }));
  });
}

export async function createApiKey(
  ctx: TenantContext,
  input: { name: string; scopes: string[] },
): Promise<{ id: string; prefix: string; rawKey: string }> {
  const rawKey = `ck_${randomToken(32)}`;
  const prefix = rawKey.slice(0, 10);
  const hash = sha256(rawKey);
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(apiKeys)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        name: input.name.slice(0, 120),
        prefix,
        keyHash: hash,
        scopes: input.scopes.slice(0, 20),
      })
      .returning({ id: apiKeys.id });
    return { id: rows[0].id, prefix, rawKey };
  });
}

export async function revokeApiKey(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, ctx.orgId), isNull(apiKeys.revokedAt)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, id));
    return { ok: true };
  });
}

export async function listWebhooks(ctx: TenantContext): Promise<WebhookEndpointRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        active: webhookEndpoints.active,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.orgId, ctx.orgId))
      .orderBy(desc(webhookEndpoints.createdAt));
    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      events: row.events ?? [],
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function createWebhook(
  ctx: TenantContext,
  input: { url: string; events: string[]; secretHash: string; secretEnc: string },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(webhookEndpoints)
      .values({
        orgId: ctx.orgId,
        url: input.url.slice(0, 2000),
        secretHash: input.secretHash,
        secretEnc: input.secretEnc,
        events: input.events.slice(0, 30),
        active: true,
      })
      .returning({ id: webhookEndpoints.id });
    return { id: rows[0].id };
  });
}

export async function updateWebhook(
  ctx: TenantContext,
  id: string,
  patch: { url?: string; events?: string[]; active?: boolean },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, ctx.orgId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    const values: Record<string, unknown> = {};
    if (patch.url !== undefined) values.url = patch.url.slice(0, 2000);
    if (patch.events !== undefined) values.events = patch.events.slice(0, 30);
    if (patch.active !== undefined) values.active = patch.active;
    if (Object.keys(values).length > 0) {
      await tx.update(webhookEndpoints).set(values).where(eq(webhookEndpoints.id, id));
    }
    return { ok: true };
  });
}

export async function deleteWebhook(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, ctx.orgId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    await tx.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
    return { ok: true };
  });
}

export async function listWebhookDeliveries(
  ctx: TenantContext,
  endpointId: string,
  limit = 50,
): Promise<WebhookDeliveryRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: webhookDeliveries.id,
        endpointId: webhookDeliveries.endpointId,
        event: webhookDeliveries.event,
        status: webhookDeliveries.status,
        attempts: webhookDeliveries.attempts,
        responseCode: webhookDeliveries.responseCode,
        nextRetryAt: webhookDeliveries.nextRetryAt,
        createdAt: webhookDeliveries.createdAt,
      })
      .from(webhookDeliveries)
      .where(
        and(eq(webhookDeliveries.orgId, ctx.orgId), eq(webhookDeliveries.endpointId, endpointId)),
      )
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      endpointId: row.endpointId,
      event: row.event,
      status: row.status,
      attempts: row.attempts,
      responseCode: row.responseCode ?? null,
      nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

/** Active endpoints in the workspace that subscribe to one event. */
export async function listWebhookEndpointsForEvent(
  ctx: TenantContext,
  event: string,
): Promise<WebhookEndpointRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        active: webhookEndpoints.active,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.orgId, ctx.orgId),
          eq(webhookEndpoints.active, true),
          sql`${webhookEndpoints.events} @> ARRAY[${event}]::text[]`,
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      events: row.events ?? [],
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

/** The endpoint plus the encrypted signing secret, for the delivery worker. */
export async function getWebhookEndpoint(
  ctx: TenantContext,
  id: string,
): Promise<{ id: string; url: string; active: boolean; secretEnc: string | null } | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        active: webhookEndpoints.active,
        secretEnc: webhookEndpoints.secretEnc,
      })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, ctx.orgId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, url: row.url, active: row.active, secretEnc: row.secretEnc ?? null };
  });
}

export interface WebhookDeliveryDetail {
  id: string;
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  responseCode: number | null;
  nextRetryAt: string | null;
}

export async function createWebhookDelivery(
  ctx: TenantContext,
  input: { endpointId: string; eventId: string; event: string; payload: Record<string, unknown> },
): Promise<{ id: string } | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(webhookDeliveries)
      .values({
        orgId: ctx.orgId,
        endpointId: input.endpointId,
        eventId: input.eventId,
        event: input.event,
        payload: input.payload,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning({ id: webhookDeliveries.id });
    return rows[0] ? { id: rows[0].id } : null;
  });
}

export async function getWebhookDelivery(
  ctx: TenantContext,
  id: string,
): Promise<WebhookDeliveryDetail | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: webhookDeliveries.id,
        endpointId: webhookDeliveries.endpointId,
        event: webhookDeliveries.event,
        payload: webhookDeliveries.payload,
        status: webhookDeliveries.status,
        attempts: webhookDeliveries.attempts,
        responseCode: webhookDeliveries.responseCode,
        nextRetryAt: webhookDeliveries.nextRetryAt,
      })
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.id, id), eq(webhookDeliveries.orgId, ctx.orgId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      endpointId: row.endpointId,
      event: row.event,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      status: row.status,
      attempts: row.attempts,
      responseCode: row.responseCode ?? null,
      nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    };
  });
}

export async function updateWebhookDelivery(
  ctx: TenantContext,
  id: string,
  patch: {
    status?: string;
    attempts?: number;
    responseCode?: number | null;
    nextRetryAt?: Date | null;
  },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const values: Record<string, unknown> = {};
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.attempts !== undefined) values.attempts = patch.attempts;
    if (patch.responseCode !== undefined) values.responseCode = patch.responseCode;
    if (patch.nextRetryAt !== undefined) values.nextRetryAt = patch.nextRetryAt;
    if (Object.keys(values).length === 0) return { ok: true };
    const rows = await tx
      .update(webhookDeliveries)
      .set(values)
      .where(and(eq(webhookDeliveries.id, id), eq(webhookDeliveries.orgId, ctx.orgId)))
      .returning({ id: webhookDeliveries.id });
    return { ok: rows.length > 0 };
  });
}
