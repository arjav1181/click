import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { chatMessages, chatThreads, meetings, transcriptSegments, transcripts, speakers } from "../schema";

export interface ChatThreadRow {
  id: string;
  title: string | null;
  scope: string;
  scopeIds: string[];
  mode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRow {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  citations: Array<{
    meetingId: string;
    segmentId: string | null;
    quote: string;
    label: string;
  }>;
  createdAt: string;
}

export interface ChatSnippet {
  meetingId: string;
  meetingTitle: string;
  segmentId: string | null;
  speakerName: string | null;
  startMs: number;
  text: string;
}

export async function listThreads(ctx: TenantContext): Promise<ChatThreadRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: chatThreads.id,
        title: chatThreads.title,
        scope: chatThreads.scope,
        scopeIds: chatThreads.scopeIds,
        mode: chatThreads.mode,
        createdAt: chatThreads.createdAt,
        updatedAt: chatThreads.updatedAt,
      })
      .from(chatThreads)
      .where(and(eq(chatThreads.orgId, ctx.orgId), eq(chatThreads.userId, ctx.userId)))
      .orderBy(desc(chatThreads.updatedAt));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      scope: row.scope,
      scopeIds: row.scopeIds ?? [],
      mode: row.mode,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  });
}

export async function createThread(
  ctx: TenantContext,
  input: { title?: string; scope?: string; scopeIds?: string[]; mode?: string },
): Promise<ChatThreadRow> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(chatThreads)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        title: input.title?.slice(0, 200) ?? null,
        scope: input.scope ?? "global",
        scopeIds: input.scopeIds ?? [],
        mode: input.mode ?? "chat",
      })
      .returning({
        id: chatThreads.id,
        title: chatThreads.title,
        scope: chatThreads.scope,
        scopeIds: chatThreads.scopeIds,
        mode: chatThreads.mode,
        createdAt: chatThreads.createdAt,
        updatedAt: chatThreads.updatedAt,
      });
    const row = rows[0];
    return {
      id: row.id,
      title: row.title,
      scope: row.scope,
      scopeIds: row.scopeIds ?? [],
      mode: row.mode,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function getThread(ctx: TenantContext, id: string): Promise<ChatThreadRow | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: chatThreads.id,
        title: chatThreads.title,
        scope: chatThreads.scope,
        scopeIds: chatThreads.scopeIds,
        mode: chatThreads.mode,
        createdAt: chatThreads.createdAt,
        updatedAt: chatThreads.updatedAt,
      })
      .from(chatThreads)
      .where(
        and(
          eq(chatThreads.id, id),
          eq(chatThreads.orgId, ctx.orgId),
          eq(chatThreads.userId, ctx.userId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      scope: row.scope,
      scopeIds: row.scopeIds ?? [],
      mode: row.mode,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function updateThread(
  ctx: TenantContext,
  id: string,
  patch: { title?: string | null },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(
        and(
          eq(chatThreads.id, id),
          eq(chatThreads.orgId, ctx.orgId),
          eq(chatThreads.userId, ctx.userId),
        ),
      )
      .limit(1);
    if (!rows[0]) return { ok: false };
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) values.title = patch.title?.slice(0, 200) ?? null;
    await tx.update(chatThreads).set(values).where(eq(chatThreads.id, id));
    return { ok: true };
  });
}

export async function deleteThread(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(
        and(
          eq(chatThreads.id, id),
          eq(chatThreads.orgId, ctx.orgId),
          eq(chatThreads.userId, ctx.userId),
        ),
      )
      .limit(1);
    if (!rows[0]) return { ok: false };
    await tx.delete(chatThreads).where(eq(chatThreads.id, id));
    return { ok: true };
  });
}

export async function listMessages(ctx: TenantContext, threadId: string): Promise<ChatMessageRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: chatMessages.id,
        role: chatMessages.role,
        content: chatMessages.content,
        model: chatMessages.model,
        tokensIn: chatMessages.tokensIn,
        tokensOut: chatMessages.tokensOut,
        citations: chatMessages.citations,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(and(eq(chatMessages.orgId, ctx.orgId), eq(chatMessages.threadId, threadId)))
      .orderBy(asc(chatMessages.createdAt));
    return rows.map((row) => ({
      id: row.id,
      role: row.role as ChatMessageRow["role"],
      content: row.content,
      model: row.model,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      citations: (row.citations ?? []) as ChatMessageRow["citations"],
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function appendMessage(
  ctx: TenantContext,
  input: {
    threadId: string;
    role: "user" | "assistant" | "tool" | "system";
    content: string;
    model?: string | null;
    tokensIn?: number;
    tokensOut?: number;
    citations?: ChatMessageRow["citations"];
  },
): Promise<ChatMessageRow> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(chatMessages)
      .values({
        orgId: ctx.orgId,
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        model: input.model ?? null,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        citations: input.citations ?? [],
      })
      .returning({
        id: chatMessages.id,
        role: chatMessages.role,
        content: chatMessages.content,
        model: chatMessages.model,
        tokensIn: chatMessages.tokensIn,
        tokensOut: chatMessages.tokensOut,
        citations: chatMessages.citations,
        createdAt: chatMessages.createdAt,
      });
    const row = rows[0];
    return {
      id: row.id,
      role: row.role as ChatMessageRow["role"],
      content: row.content,
      model: row.model,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      citations: (row.citations ?? []) as ChatMessageRow["citations"],
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/**
 * Gathers transcript segments for the chat context. For a "global" scope this
 * walks every meeting; for a folder/channel scope it filters to meetings in
 * that container.
 */
export async function gatherSnippets(
  ctx: TenantContext,
  scope: string,
  scopeIds: string[],
  limit = 200,
): Promise<ChatSnippet[]> {
  return withTenant(ctx, async (tx) => {
    // Resolve the meeting ids in scope.
    let meetingIds: string[] = [];
    if (scope === "global" || scope === "meeting") {
      const rows = await tx
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.orgId, ctx.orgId))
        .orderBy(desc(meetings.startedAt))
        .limit(50);
      meetingIds = rows.map((row) => row.id);
    } else if (scope === "folder" && scopeIds.length) {
      const rows = await tx.execute(sql`
        select m.id
        from meetings m
        inner join meeting_folders mf on mf.meeting_id = m.id
        where m.org_id = ${ctx.orgId} and mf.folder_id in (${sql.join(
          scopeIds.map((value) => sql`${value}::uuid`),
          sql`, `,
        )})
        order by m.started_at desc
        limit 50
      `);
      meetingIds = (rows.rows as Array<{ id: string }>).map((row) => row.id);
    } else if (scope === "channel" && scopeIds.length) {
      const rows = await tx.execute(sql`
        select m.id
        from meetings m
        inner join meeting_channels mc on mc.meeting_id = m.id
        where m.org_id = ${ctx.orgId} and mc.channel_id in (${sql.join(
          scopeIds.map((value) => sql`${value}::uuid`),
          sql`, `,
        )})
        order by m.started_at desc
        limit 50
      `);
      meetingIds = (rows.rows as Array<{ id: string }>).map((row) => row.id);
    }

    if (meetingIds.length === 0) return [];

    // Pull meeting titles.
    const meetingRows = await tx
      .select({ id: meetings.id, title: meetings.title })
      .from(meetings)
      .where(inArray(meetings.id, meetingIds));
    const titleById = new Map(meetingRows.map((row) => [row.id, row.title]));

    // Pull transcript segments for those meetings.
    const transcriptRows = await tx
      .select({ id: transcripts.id, meetingId: transcripts.meetingId })
      .from(transcripts)
      .where(inArray(transcripts.meetingId, meetingIds));

    const snippets: ChatSnippet[] = [];
    for (const transcript of transcriptRows) {
      const segmentRows = await tx.execute(sql`
        select s.id, s.start_ms, s.text, sp.name as speaker_name
        from transcript_segments s
        left join speakers sp on sp.id = s.speaker_id
        where s.transcript_id = ${transcript.id}
        order by s.idx
        limit 20
      `);
      for (const segment of segmentRows.rows as Array<Record<string, unknown>>) {
        snippets.push({
          meetingId: transcript.meetingId,
          meetingTitle: titleById.get(transcript.meetingId) ?? "Meeting",
          segmentId: String(segment.id),
          speakerName: segment.speaker_name ? String(segment.speaker_name) : null,
          startMs: Number(segment.start_ms),
          text: String(segment.text),
        });
        if (snippets.length >= limit) break;
      }
      if (snippets.length >= limit) break;
    }
    return snippets;
  });
}
