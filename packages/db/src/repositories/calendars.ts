import { and, asc, eq, gte, lte } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { calendarConnections, calendarEvents } from "../schema";

export interface CalendarConnectionRow {
  id: string;
  provider: "google" | "microsoft";
  accountEmail: string;
  status: "connected" | "expired" | "revoked" | "error";
  syncCursor: string | null;
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
  autoJoin: boolean;
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
