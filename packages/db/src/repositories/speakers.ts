import { and, asc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { speakers, transcriptSegments, transcripts } from "../schema";

export interface SpeakerRow {
  id: string;
  name: string | null;
  email: string | null;
  isMe: boolean;
  mergedIntoId: string | null;
  meetingCount: number;
  segmentCount: number;
}

export async function listSpeakers(ctx: TenantContext): Promise<SpeakerRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: speakers.id,
        name: speakers.name,
        email: speakers.email,
        isMe: speakers.isMe,
        mergedIntoId: speakers.mergedIntoId,
        segmentCount: sql<number>`(select count(*)::int from ${transcriptSegments} s where s.speaker_id = ${speakers.id})`,
      })
      .from(speakers)
      .where(eq(speakers.orgId, ctx.orgId))
      .orderBy(asc(speakers.name));
    // meeting count = distinct transcripts that contain a segment by this speaker
    const result: SpeakerRow[] = [];
    for (const row of rows) {
      const mc = await tx.execute(sql`
        select count(distinct t.meeting_id)::int as n
        from ${transcriptSegments} s
        inner join ${transcripts} t on t.id = s.transcript_id
        where s.speaker_id = ${row.id}
      `);
      result.push({
        id: row.id,
        name: row.name,
        email: row.email,
        isMe: row.isMe,
        mergedIntoId: row.mergedIntoId,
        meetingCount: Number((mc.rows as Array<{ n: number }>)[0]?.n ?? 0),
        segmentCount: row.segmentCount,
      });
    }
    return result;
  });
}

export async function renameSpeaker(ctx: TenantContext, id: string, name: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: speakers.id })
      .from(speakers)
      .where(and(eq(speakers.id, id), eq(speakers.orgId, ctx.orgId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    await tx.update(speakers).set({ name: name.slice(0, 120) }).where(eq(speakers.id, id));
    return { ok: true };
  });
}

export async function mergeSpeakers(ctx: TenantContext, sourceId: string, targetId: string): Promise<{ ok: boolean }> {
  if (sourceId === targetId) return { ok: false };
  return withTenant(ctx, async (tx) => {
    const both = await tx
      .select({ id: speakers.id })
      .from(speakers)
      .where(and(eq(speakers.orgId, ctx.orgId), sql`${speakers.id} in (${sourceId}::uuid, ${targetId}::uuid)`));
    if (both.length < 2) return { ok: false };

    // Reassign segments from source to target.
    await tx.execute(sql`
      update ${transcriptSegments}
      set speaker_id = ${targetId}::uuid
      where speaker_id = ${sourceId}::uuid
    `);

    // Mark the source as merged.
    await tx
      .update(speakers)
      .set({ mergedIntoId: targetId })
      .where(eq(speakers.id, sourceId));

    return { ok: true };
  });
}
