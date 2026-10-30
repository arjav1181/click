import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
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
  input: { url: string; events: string[] },
): Promise<{ id: string; secret: string }> {
  const secret = `whsec_${randomToken(32)}`;
  const secretHash = sha256(secret);
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(webhookEndpoints)
      .values({
        orgId: ctx.orgId,
        url: input.url.slice(0, 2000),
        secretHash,
        events: input.events.slice(0, 30),
        active: true,
      })
      .returning({ id: webhookEndpoints.id });
    return { id: rows[0].id, secret };
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
      createdAt: row.createdAt.toISOString(),
    }));
  });
}
