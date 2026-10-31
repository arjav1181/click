import { and, asc, eq, gte, lte } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { calendarConnections, calendarEvents, calendarRules } from "../schema";

export interface CalendarConnectionRow {
  id: string;
  provider: "google" | "microsoft";
  accountEmail: string;
  status: "connected" | "expired" | "revoked" | "error";
  syncCursor: string | null;
  autoJoin: boolean;
  createdAt: string;
}

export async function listCalendarConnections(ctx: TenantContext): Promise<CalendarConnectionRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: calendarConnections.id,
        provider: calendarConnections.provider,
        accountEmail: calendarConnections.accountEmail,
        status: calendarConnections.status,
        syncCursor: calendarConnections.syncCursor,
        autoJoin: calendarConnections.autoJoin,
        createdAt: calendarConnections.createdAt,
      })
      .from(calendarConnections)
      .where(eq(calendarConnections.orgId, ctx.orgId))
      .orderBy(asc(calendarConnections.createdAt));
    return rows.map((row) => ({
      id: row.id,
      provider: row.provider as CalendarConnectionRow["provider"],
      accountEmail: row.accountEmail,
      status: row.status as CalendarConnectionRow["status"],
      syncCursor: row.syncCursor,
      autoJoin: row.autoJoin,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function createCalendarConnection(
  ctx: TenantContext,
  input: { provider: "google" | "microsoft"; accountEmail: string },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(calendarConnections)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        provider: input.provider,
        accountEmail: input.accountEmail,
        refreshTokenEnc: "placeholder",
        status: "connected",
      })
      .returning({ id: calendarConnections.id });
    return { id: rows[0].id };
  });
}

/** Stores the OAuth result of a completed consent flow. */
export async function saveCalendarTokens(
  ctx: TenantContext,
  input: {
    provider: "google" | "microsoft";
    accountEmail: string;
    refreshTokenEnc: string;
  },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(calendarConnections)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        provider: input.provider,
        accountEmail: input.accountEmail,
        refreshTokenEnc: input.refreshTokenEnc,
        status: "connected",
      })
      .onConflictDoUpdate({
        target: [calendarConnections.userId, calendarConnections.provider, calendarConnections.accountEmail],
        set: { refreshTokenEnc: input.refreshTokenEnc, status: "connected", updatedAt: new Date() },
      })
      .returning({ id: calendarConnections.id });
    return { id: rows[0].id };
  });
}

export async function getCalendarConnection(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: calendarConnections.id,
        provider: calendarConnections.provider,
        accountEmail: calendarConnections.accountEmail,
        refreshTokenEnc: calendarConnections.refreshTokenEnc,
        status: calendarConnections.status,
        autoJoin: calendarConnections.autoJoin,
      })
      .from(calendarConnections)
      .where(and(eq(calendarConnections.id, id), eq(calendarConnections.orgId, ctx.orgId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider as "google" | "microsoft",
      accountEmail: row.accountEmail,
      refreshTokenEnc: row.refreshTokenEnc,
      status: row.status as CalendarConnectionRow["status"],
      autoJoin: row.autoJoin,
    };
  });
}

export async function updateCalendarConnection(
  ctx: TenantContext,
  id: string,
  patch: { autoJoin?: boolean; status?: CalendarConnectionRow["status"] },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .update(calendarConnections)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(calendarConnections.id, id), eq(calendarConnections.orgId, ctx.orgId)))
      .returning({ id: calendarConnections.id });
    return { ok: rows.length > 0 };
  });
}

export async function deleteCalendarConnection(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(calendarConnections)
      .where(and(eq(calendarConnections.id, id), eq(calendarConnections.orgId, ctx.orgId)))
      .returning({ id: calendarConnections.id });
    return { ok: rows.length > 0 };
  });
}

export interface CalendarEventRow {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  meetingUrl: string | null;
  provider: string | null;
  autoJoin: boolean | null;
  botStatus: string;
}

export async function listCalendarEvents(
  ctx: TenantContext,
  range: { from: Date; to: Date },
): Promise<CalendarEventRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        startsAt: calendarEvents.startsAt,
        endsAt: calendarEvents.endsAt,
        meetingUrl: calendarEvents.meetingUrl,
        provider: calendarEvents.provider,
        autoJoin: calendarEvents.autoJoin,
        botStatus: calendarEvents.botStatus,
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.orgId, ctx.orgId),
          gte(calendarEvents.endsAt, range.from),
          lte(calendarEvents.startsAt, range.to),
        ),
      )
      .orderBy(asc(calendarEvents.startsAt));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      meetingUrl: row.meetingUrl,
      provider: row.provider,
      autoJoin: row.autoJoin,
      botStatus: row.botStatus,
    }));
  });
}

export interface CalendarEventInput {
  externalId: string;
  title: string | null;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  organizerEmail: string | null;
  attendees: Array<{ email: string; name: string | null }>;
  meetingUrl: string | null;
  provider: string;
}

/**
 * Upserts the events of one connection. A manual per-event override of
 * `auto_join` is never overwritten by a sync.
 */
export async function upsertCalendarEvents(
  ctx: TenantContext,
  connectionId: string,
  events: CalendarEventInput[],
): Promise<number> {
  return withTenant(ctx, async (tx) => {
    let written = 0;
    for (const event of events) {
      const existing = await tx
        .select({ id: calendarEvents.id, autoJoin: calendarEvents.autoJoin })
        .from(calendarEvents)
        .where(and(eq(calendarEvents.connectionId, connectionId), eq(calendarEvents.externalId, event.externalId)))
        .limit(1);
      const values = {
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        organizerEmail: event.organizerEmail,
        attendees: event.attendees,
        meetingUrl: event.meetingUrl,
        provider: event.provider,
        updatedAt: new Date(),
      };
      if (existing[0]) {
        await tx
          .update(calendarEvents)
          .set(values)
          .where(eq(calendarEvents.id, existing[0].id));
      } else {
        await tx.insert(calendarEvents).values({
          orgId: ctx.orgId,
          connectionId,
          externalId: event.externalId,
          ...values,
        });
      }
      written += 1;
    }
    return written;
  });
}

/** Events of one connection inside the sync window, with the fields the bot needs. */
export async function listConnectionEvents(ctx: TenantContext, connectionId: string, range: { from: Date; to: Date }) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: calendarEvents.id,
        externalId: calendarEvents.externalId,
        title: calendarEvents.title,
        startsAt: calendarEvents.startsAt,
        endsAt: calendarEvents.endsAt,
        meetingUrl: calendarEvents.meetingUrl,
        attendees: calendarEvents.attendees,
        autoJoin: calendarEvents.autoJoin,
        botStatus: calendarEvents.botStatus,
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.orgId, ctx.orgId),
          eq(calendarEvents.connectionId, connectionId),
          gte(calendarEvents.startsAt, range.from),
          lte(calendarEvents.startsAt, range.to),
        ),
      )
      .orderBy(asc(calendarEvents.startsAt));
    return rows.map((row) => ({
      id: row.id,
      externalId: row.externalId,
      title: row.title,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      meetingUrl: row.meetingUrl,
      attendees: (row.attendees ?? []) as Array<{ email: string; name: string | null }>,
      autoJoin: row.autoJoin,
      botStatus: row.botStatus,
    }));
  });
}

export async function setEventAutoJoin(
  ctx: TenantContext,
  eventId: string,
  autoJoin: boolean | null,
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .update(calendarEvents)
      .set({ autoJoin, updatedAt: new Date() })
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.orgId, ctx.orgId)))
      .returning({ id: calendarEvents.id });
    return { ok: rows.length > 0 };
  });
}

/** Records that a bot was queued (or failed) for this event. */
export async function setEventBotStatus(
  ctx: TenantContext,
  eventId: string,
  status: string,
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx
      .update(calendarEvents)
      .set({ botStatus: status, updatedAt: new Date() })
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.orgId, ctx.orgId)));
  });
}

export interface CalendarRuleRow {
  id: string;
  connectionId: string | null;
  titlePattern: string | null;
  hostPattern: string | null;
  attendeeEmail: string | null;
  autoJoin: boolean;
  priority: number;
  createdAt: string;
}

export async function listCalendarRules(ctx: TenantContext): Promise<CalendarRuleRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: calendarRules.id,
        connectionId: calendarRules.connectionId,
        titlePattern: calendarRules.titlePattern,
        hostPattern: calendarRules.hostPattern,
        attendeeEmail: calendarRules.attendeeEmail,
        autoJoin: calendarRules.autoJoin,
        priority: calendarRules.priority,
        createdAt: calendarRules.createdAt,
      })
      .from(calendarRules)
      .where(eq(calendarRules.orgId, ctx.orgId))
      .orderBy(asc(calendarRules.priority));
    return rows.map((row) => ({
      id: row.id,
      connectionId: row.connectionId,
      titlePattern: row.titlePattern,
      hostPattern: row.hostPattern,
      attendeeEmail: row.attendeeEmail,
      autoJoin: row.autoJoin,
      priority: row.priority,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function createCalendarRule(
  ctx: TenantContext,
  input: {
    connectionId?: string | null;
    titlePattern?: string | null;
    hostPattern?: string | null;
    attendeeEmail?: string | null;
    autoJoin: boolean;
    priority?: number;
  },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(calendarRules)
      .values({
        orgId: ctx.orgId,
        connectionId: input.connectionId ?? null,
        titlePattern: input.titlePattern?.slice(0, 200) ?? null,
        hostPattern: input.hostPattern?.slice(0, 200) ?? null,
        attendeeEmail: input.attendeeEmail?.toLowerCase() ?? null,
        autoJoin: input.autoJoin,
        priority: input.priority ?? 100,
      })
      .returning({ id: calendarRules.id });
    return { id: rows[0].id };
  });
}

export async function deleteCalendarRule(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(calendarRules)
      .where(and(eq(calendarRules.id, id), eq(calendarRules.orgId, ctx.orgId)))
      .returning({ id: calendarRules.id });
    return { ok: rows.length > 0 };
  });
}
