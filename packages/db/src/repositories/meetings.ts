import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import {
  meetings,
  meetingParticipants,
  transcripts,
  users,
  folders,
  meetingFolders,
  recordings,
} from "../schema";

export interface MeetingListItem {
  id: string;
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  source: string;
  status: string;
  language: string;
  privacy: string;
  ownerId: string;
  ownerName: string;
  participantCount: number;
  folderName: string | null;
  hasTranscript: boolean;
  hasSummary: boolean;
  audioAvailable: boolean;
}

const meetingId = sql.raw('"meetings"."id"');

const baseSelect = {
  id: meetings.id,
  title: meetings.title,
  startedAt: meetings.startedAt,
  endedAt: meetings.endedAt,
  durationSeconds: meetings.durationS,
  source: meetings.source,
  status: meetings.status,
  language: meetings.language,
  privacy: meetings.privacy,
  ownerId: meetings.ownerId,
  ownerName: users.name,
  participantCount: sql<number>`(select count(*)::int from ${meetingParticipants} p where p.meeting_id = ${meetingId})`,
  folderName: sql<string | null>`(select f.name from ${meetingFolders} mf join ${folders} f on f.id = mf.folder_id where mf.meeting_id = ${meetingId} limit 1)`,
  hasTranscript: sql<boolean>`exists (select 1 from ${transcripts} t where t.meeting_id = ${meetingId})`,
  hasSummary: sql<boolean>`exists (select 1 from notes n where n.meeting_id = ${meetingId} and n.status = 'ready')`,
  audioAvailable: sql<boolean>`exists (select 1 from recordings r where r.meeting_id = ${meetingId} and r.deleted_at is null)`,
};

type Row = {
  id: string;
  title: string;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  source: string;
  status: string;
  language: string;
  privacy: string;
  ownerId: string;
  ownerName: string | null;
  participantCount: number;
  folderName: string | null;
  hasTranscript: boolean;
  hasSummary: boolean;
  audioAvailable: boolean;
};

const map = (row: Row): MeetingListItem => ({
  id: row.id,
  title: row.title,
  startedAt: row.startedAt?.toISOString() ?? null,
  endedAt: row.endedAt?.toISOString() ?? null,
  durationSeconds: row.durationSeconds ?? 0,
  source: row.source,
  status: row.status,
  language: row.language,
  privacy: row.privacy,
  ownerId: row.ownerId,
  ownerName: row.ownerName ?? "Unknown",
  participantCount: row.participantCount,
  folderName: row.folderName,
  hasTranscript: row.hasTranscript,
  hasSummary: row.hasSummary,
  audioAvailable: row.audioAvailable,
});

export async function listMeetings(
  ctx: TenantContext,
  filters: { q?: string; status?: string; folderId?: string; channelId?: string; limit?: number } = {},
): Promise<{ meetings: MeetingListItem[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const conditions = [isNull(meetings.deletedAt)];
    if (filters.q) conditions.push(ilike(meetings.title, `%${filters.q}%`));
    if (filters.status) conditions.push(eq(meetings.status, filters.status as never));
    if (filters.folderId) {
      conditions.push(
        sql`exists (select 1 from ${meetingFolders} mf where mf.meeting_id = ${meetings.id} and mf.folder_id = ${filters.folderId})`,
      );
    }
    if (filters.channelId) {
      conditions.push(
        sql`exists (select 1 from meeting_channels mc where mc.meeting_id = ${meetingId} and mc.channel_id = ${filters.channelId})`,
      );
    }

    const rows = await tx
      .select(baseSelect)
      .from(meetings)
      .innerJoin(users, eq(users.id, meetings.ownerId))
      .where(and(...conditions))
      .orderBy(desc(meetings.startedAt), desc(meetings.createdAt))
      .limit(Math.min(filters.limit ?? 50, 100));

    const countRows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(meetings)
      .where(and(...conditions));

    return { meetings: rows.map(map), total: countRows[0]?.n ?? rows.length };
  });
}

export async function getMeeting(ctx: TenantContext, id: string): Promise<MeetingListItem | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select(baseSelect)
      .from(meetings)
      .innerJoin(users, eq(users.id, meetings.ownerId))
      .where(and(eq(meetings.id, id), isNull(meetings.deletedAt)))
      .limit(1);
    return rows[0] ? map(rows[0]) : null;
  });
}

export async function createMeeting(
  ctx: TenantContext,
  input: { title: string; source: string; startedAt?: Date; calendarEventId?: string | null; status?: string },
): Promise<MeetingListItem> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(meetings)
      .values({
        orgId: ctx.orgId,
        ownerId: ctx.userId,
        title: input.title.slice(0, 300),
        source: input.source as never,
        status: (input.status ?? "processing") as never,
        startedAt: input.startedAt ?? new Date(),
        calendarEventId: input.calendarEventId ?? null,
      })
      .returning({ id: meetings.id });
    const created = await tx
      .select(baseSelect)
      .from(meetings)
      .innerJoin(users, eq(users.id, meetings.ownerId))
      .where(eq(meetings.id, rows[0].id))
      .limit(1);
    return map(created[0]);
  });
}

export async function updateMeeting(
  ctx: TenantContext,
  id: string,
  patch: { title?: string; privacy?: string; folderId?: string | null },
) {
  return withTenant(ctx, async (tx) => {
    const values: Record<string, unknown> = {};
    if (patch.title !== undefined) values.title = patch.title.slice(0, 300);
    if (patch.privacy !== undefined) values.privacy = patch.privacy;
    if (Object.keys(values).length > 0) {
      await tx.update(meetings).set(values).where(and(eq(meetings.id, id), eq(meetings.orgId, ctx.orgId)));
    }
    if (patch.folderId !== undefined) {
      await tx.delete(meetingFolders).where(eq(meetingFolders.meetingId, id));
      if (patch.folderId) {
        await tx.insert(meetingFolders).values({ meetingId: id, folderId: patch.folderId });
      }
    }
    return getMeeting(ctx, id);
  });
}

export async function softDeleteMeeting(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (tx) => {
    await tx
      .update(meetings)
      .set({ deletedAt: new Date() })
      .where(and(eq(meetings.id, id), eq(meetings.orgId, ctx.orgId)));
  });
}

export async function restoreMeeting(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (tx) => {
    await tx
      .update(meetings)
      .set({ deletedAt: null })
      .where(and(eq(meetings.id, id), eq(meetings.orgId, ctx.orgId)));
  });
}

export async function getTranscript(ctx: TenantContext, meetingId: string) {
  return withTenant(ctx, async (tx) => {
    const transcriptRows = await tx
      .select({
        id: transcripts.id,
        language: transcripts.language,
        provider: transcripts.provider,
        model: transcripts.model,
        status: transcripts.status,
        wordCount: transcripts.wordCount,
      })
      .from(transcripts)
      .where(eq(transcripts.meetingId, meetingId))
      .limit(1);
    const transcript = transcriptRows[0];
    if (!transcript) return { transcript: null, segments: [] };

    const segments = await tx.execute(sql`
      select s.id, s.idx, s.start_ms, s.end_ms, s.text, s.edited, s.confidence,
             sp.name as speaker_name, sp.id as speaker_id, sp.is_me
      from transcript_segments s
      left join speakers sp on sp.id = s.speaker_id
      where s.transcript_id = ${transcript.id}
      order by s.idx
    `);

    return {
      transcript,
      segments: (segments.rows as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        index: Number(r.idx),
        startMs: Number(r.start_ms),
        endMs: Number(r.end_ms),
        text: String(r.text),
        edited: Boolean(r.edited),
        confidence: r.confidence === null ? null : Number(r.confidence),
        speakerId: r.speaker_id ? String(r.speaker_id) : null,
        speakerName: r.speaker_name ? String(r.speaker_name) : null,
        speakerIsMe: Boolean(r.is_me),
      })),
    };
  });
}

export async function updateSegment(
  ctx: TenantContext,
  meetingId: string,
  segmentId: string,
  patch: { text?: string; speakerId?: string | null },
) {
  return withTenant(ctx, async (tx) => {
    const sets = [sql`edited = true`];
    if (patch.text !== undefined) sets.push(sql`text = ${patch.text.slice(0, 20_000)}`);
    if (patch.speakerId !== undefined) sets.push(sql`speaker_id = ${patch.speakerId}`);
    const result = await tx.execute(sql`
      update transcript_segments s
      set ${sql.join(sets, sql`, `)}
      from transcripts t
      where s.transcript_id = t.id and t.meeting_id = ${meetingId} and s.id = ${segmentId}
      returning s.id
    `);
    return (result.rowCount ?? 0) > 0;
  });
}

export async function getMeetingRecording(ctx: TenantContext, meetingId: string) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: recordings.id,
        storageKey: recordings.storageKey,
        kind: recordings.kind,
        sizeBytes: recordings.sizeBytes,
        createdAt: recordings.createdAt,
      })
      .from(recordings)
      .where(and(eq(recordings.meetingId, meetingId), isNull(recordings.deletedAt)))
      .orderBy(desc(recordings.createdAt))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function setConsent(ctx: TenantContext, meetingId: string, consent: "pending" | "acknowledged" | "declined") {
  return withTenant(ctx, async (tx) => {
    await tx.update(meetings).set({ consentState: consent }).where(eq(meetings.id, meetingId));
    return true;
  });
}
