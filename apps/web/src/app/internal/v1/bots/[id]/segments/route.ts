import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { speakers, transcripts, transcriptSegments, withTenant, botsRepo } from "@click/db";
import { handler, json, ApiError } from "@/server/http";
import { readVerifiedBody } from "@/server/bot";

const schema = z.object({
  segments: z
    .array(
      z.object({
        idx: z.number().int().nonnegative(),
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
        text: z.string().min(1).max(20_000),
        speaker: z.string().max(120).nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { body } = await readVerifiedBody(request);
  const payload = schema.parse(body);

  const job = await botsRepo.findBotJob(id);
  if (!job) throw new ApiError(404, "not_found", "Bot job not found.");

  const ctx = { orgId: job.orgId, userId: "00000000-0000-0000-0000-000000000000" };
  const inserted = await withTenant(ctx, async (tx) => {
    const transcript = await tx
      .insert(transcripts)
      .values({ orgId: job.orgId, meetingId: job.meetingId, status: "streaming" })
      .onConflictDoUpdate({
        target: transcripts.meetingId,
        set: { status: "streaming", updatedAt: new Date() },
      })
      .returning({ id: transcripts.id });

    const speakerIds = new Map<string, string>();
    for (const name of new Set(payload.segments.map((s) => s.speaker?.trim()).filter(Boolean) as string[])) {
      const existing = await tx
        .select({ id: speakers.id })
        .from(speakers)
        .where(and(eq(speakers.orgId, job.orgId), eq(speakers.name, name)))
        .limit(1);
      if (existing[0]) {
        speakerIds.set(name, existing[0].id);
      } else {
        const rows = await tx.insert(speakers).values({ orgId: job.orgId, name }).returning({ id: speakers.id });
        speakerIds.set(name, rows[0].id);
      }
    }

    for (const segment of payload.segments) {
      await tx
        .insert(transcriptSegments)
        .values({
          orgId: job.orgId,
          transcriptId: transcript[0].id,
          idx: segment.idx,
          speakerId: segment.speaker ? (speakerIds.get(segment.speaker) ?? null) : null,
          startMs: segment.startMs,
          endMs: Math.max(segment.startMs, segment.endMs),
          text: segment.text,
          rawText: segment.text,
          confidence: segment.confidence != null ? String(segment.confidence.toFixed(3)) : null,
        })
        .onConflictDoUpdate({
          target: [transcriptSegments.transcriptId, transcriptSegments.idx],
          set: {
            text: sql`excluded.text`,
            startMs: sql`excluded.start_ms`,
            endMs: sql`excluded.end_ms`,
            speakerId: sql`excluded.speaker_id`,
            updatedAt: new Date(),
          },
        });
    }

    await tx.execute(sql`update meetings set status = 'live' where id = ${job.meetingId} and status <> 'ready'`);
    return payload.segments.length;
  });

  return json({ ok: true, received: inserted }, { status: 202 });
});
