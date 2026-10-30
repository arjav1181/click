import { desc, eq } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { calendarEvents, meetings } from "../schema";

export interface BriefBullet {
  text: string;
  sourceMeetingId?: string;
  sourceTitle?: string;
}

export interface BriefData {
  eventId: string;
  eventTitle: string | null;
  eventStartsAt: string | null;
  bullets: BriefBullet[];
}

export async function buildBrief(ctx: TenantContext, eventId: string): Promise<BriefData | null> {
  return withTenant(ctx, async (tx) => {
    const eventRows = await tx
      .select({ id: calendarEvents.id, title: calendarEvents.title, startsAt: calendarEvents.startsAt })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, eventId))
      .limit(1);
    const event = eventRows[0];
    if (!event) return null;

    const recent = await tx
      .select({ id: meetings.id, title: meetings.title })
      .from(meetings)
      .where(eq(meetings.orgId, ctx.orgId))
      .orderBy(desc(meetings.startedAt))
      .limit(5);

    const bullets: BriefBullet[] = [
      { text: `Upcoming: ${event.title ?? "Meeting"} at ${event.startsAt.toISOString()}.` },
      ...recent.map((m) => ({ text: `Related past meeting: ${m.title}.`, sourceMeetingId: m.id, sourceTitle: m.title })),
    ];
    return {
      eventId: event.id,
      eventTitle: event.title,
      eventStartsAt: event.startsAt.toISOString(),
      bullets,
    };
  });
}
