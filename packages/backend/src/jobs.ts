import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  actionItems,
  citations,
  embeddings,
  meetings,
  noteSections,
  notes,
  recordings,
  speakers,
  templates,
  transcriptSegments,
  transcripts,
  withTenant,
  workspaceRepo,
} from "@click/db";
import { aiConfig } from "./env";
import { sendMail } from "./mailer";
import type { EmailContent } from "./emails";
import { getObject } from "./storage";
import {
  assertBudget,
  embedTexts,
  recordUsage,
  resolveProviderOverride,
  summarize,
  transcribe,
  type SummaryCitation,
} from "./providers";

export interface TranscribeJobData {
  orgId: string;
  meetingId: string;
  recordingId: string;
}

export interface SummarizeJobData {
  orgId: string;
  meetingId: string;
  templateId?: string | null;
  length?: "short" | "standard" | "detailed";
}

export interface EmbedJobData {
  orgId: string;
  meetingId: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface CalendarSyncJobData {
  orgId: string;
  connectionId: string;
}

export interface BotJoinJobData {
  orgId: string;
  botJobId: string;
}

export type JobPayload =
  | { name: "transcribe"; data: TranscribeJobData }
  | { name: "summarize"; data: SummarizeJobData }
  | { name: "embed"; data: EmbedJobData }
  | { name: "email"; data: EmailJobData }
  | { name: "calendar-sync"; data: CalendarSyncJobData }
  | { name: "bot-join"; data: BotJoinJobData };

export interface JobOutcome {
  orgId: string;
  meetingId?: string;
}

async function readAll(stream: NodeJS.ReadableStream, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("Recording exceeds the processing size limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function transcribeJob(data: TranscribeJobData): Promise<JobOutcome> {
  const ctx = { orgId: data.orgId, userId: "00000000-0000-0000-0000-000000000000" };

  const context = await withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        storageKey: recordings.storageKey,
        kind: recordings.kind,
        title: meetings.title,
        language: meetings.language,
        ownerId: meetings.ownerId,
      })
      .from(recordings)
      .innerJoin(meetings, eq(meetings.id, recordings.meetingId))
      .where(eq(recordings.id, data.recordingId))
      .limit(1);
    return rows[0] ?? null;
  });
  if (!context) throw new Error("Recording not found for this workspace.");

  const transcriptId = await withTenant(ctx, async (tx) => {
    await tx.update(meetings).set({ status: "processing", failureReason: null }).where(eq(meetings.id, data.meetingId));
    const rows = await tx
      .insert(transcripts)
      .values({
        orgId: data.orgId,
        meetingId: data.meetingId,
        language: context.language || "en",
        status: "processing",
      })
      .onConflictDoUpdate({
        target: transcripts.meetingId,
        set: { status: "processing", updatedAt: new Date() },
      })
      .returning({ id: transcripts.id });
    return rows[0].id;
  });

  try {
    await assertBudget(data.orgId);
    const object = await getObject(context.storageKey);
    if (!object) throw new Error("The recording file is missing from storage.");
    const audio = await readAll(object.body, 1024 * 1024 * 1024);
    const result = await transcribe({
      audio,
      filename: context.storageKey.split("/").pop() ?? "recording",
      mimeType: object.contentType,
      language: context.language || undefined,
      override: await resolveProviderOverride(data.orgId, "asr"),
    });
    if (result.segments.length === 0) throw new Error("Transcription returned no speech segments.");

    let durationSeconds = 0;
    await withTenant(ctx, async (tx) => {
      await tx.delete(transcriptSegments).where(eq(transcriptSegments.transcriptId, transcriptId));

      const speakerIds = new Map<string, string>();
      for (const name of new Set(result.segments.map((s) => s.speaker?.trim()).filter(Boolean) as string[])) {
        const existing = await tx
          .select({ id: speakers.id })
          .from(speakers)
          .where(and(eq(speakers.orgId, data.orgId), eq(speakers.name, name)))
          .limit(1);
        if (existing[0]) {
          speakerIds.set(name, existing[0].id);
        } else {
          const inserted = await tx
            .insert(speakers)
            .values({ orgId: data.orgId, name })
            .returning({ id: speakers.id });
          speakerIds.set(name, inserted[0].id);
        }
      }

      const rows = result.segments.map((segment, index) => ({
        orgId: data.orgId,
        transcriptId,
        idx: index,
        speakerId: segment.speaker ? (speakerIds.get(segment.speaker) ?? null) : null,
        startMs: Math.max(0, Math.round(segment.startMs)),
        endMs: Math.max(Math.round(segment.startMs), Math.round(segment.endMs)),
        text: segment.text.slice(0, 20_000),
        rawText: segment.text.slice(0, 20_000),
        confidence: segment.confidence != null ? String(segment.confidence.toFixed(3)) : null,
      }));

      for (let offset = 0; offset < rows.length; offset += 500) {
        await tx.insert(transcriptSegments).values(rows.slice(offset, offset + 500));
      }

      const wordCount = rows.reduce((sum, row) => sum + row.text.split(/\s+/).length, 0);
      const confidences = result.segments
        .map((s) => s.confidence)
        .filter((c): c is number => typeof c === "number");
      const average = confidences.length
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
        : null;

      await tx
        .update(transcripts)
        .set({
          status: "ready",
          language: result.language,
          provider: result.provider,
          model: result.model,
          wordCount,
          confidenceAvg: average != null ? average.toFixed(3) : null,
          updatedAt: new Date(),
        })
        .where(eq(transcripts.id, transcriptId));

      durationSeconds = Math.max(
        Math.round(result.durationMs / 1000),
        Math.ceil(Math.max(...rows.map((row) => row.endMs)) / 1000),
      );
      await tx
        .update(recordings)
        .set({ durationS: durationSeconds })
        .where(eq(recordings.id, data.recordingId));
      await tx
        .update(meetings)
        .set({ durationS: durationSeconds, endedAt: new Date() })
        .where(eq(meetings.id, data.meetingId));
    });

    await recordUsage(data.orgId, { asrSeconds: durationSeconds });
    return { orgId: data.orgId, meetingId: data.meetingId };
  } catch (error) {
    await withTenant(ctx, async (tx) => {
      await tx
        .update(transcripts)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(transcripts.id, transcriptId));
      await tx
        .update(meetings)
        .set({ status: "failed", failureReason: error instanceof Error ? error.message.slice(0, 500) : "Transcription failed" })
        .where(eq(meetings.id, data.meetingId));
    });
    throw error;
  }
}

export async function summarizeJob(data: SummarizeJobData): Promise<JobOutcome> {
  const meeting = await withTenant({ orgId: data.orgId, userId: "00000000-0000-0000-0000-000000000000" }, async (tx) => {
    const rows = await tx
      .select({ title: meetings.title, ownerId: meetings.ownerId })
      .from(meetings)
      .where(eq(meetings.id, data.meetingId))
      .limit(1);
    return rows[0] ?? null;
  });
  if (!meeting) throw new Error("Meeting not found for this workspace.");

  const ctx = { orgId: data.orgId, userId: meeting.ownerId };
  const note = await withTenant(ctx, async (tx) => {
    const existing = await tx
      .select({ id: notes.id, version: notes.version })
      .from(notes)
      .where(eq(notes.meetingId, data.meetingId))
      .orderBy(asc(notes.createdAt))
      .limit(1);
    if (existing[0]) {
      await tx
        .update(notes)
        .set({ status: "generating", templateId: data.templateId ?? null, version: existing[0].version + 1 })
        .where(eq(notes.id, existing[0].id));
      return { id: existing[0].id, version: existing[0].version + 1 };
    }
    const inserted = await tx
      .insert(notes)
      .values({
        orgId: data.orgId,
        meetingId: data.meetingId,
        authorId: meeting.ownerId,
        status: "generating",
        templateId: data.templateId ?? null,
      })
      .returning({ id: notes.id });
    return { id: inserted[0].id, version: 1 };
  });

  try {
    await assertBudget(data.orgId);
    const transcript = await withTenant(ctx, async (tx) => {
      const rows = await tx.execute(sql`
        select s.id, s.idx, s.start_ms, s.text, coalesce(sp.name, 'Speaker') as speaker
        from transcript_segments s
        join transcripts t on t.id = s.transcript_id
        left join speakers sp on sp.id = s.speaker_id
        where t.meeting_id = ${data.meetingId}
        order by s.idx
      `);
      return (rows.rows as Array<{ id: string; idx: number; start_ms: number; text: string; speaker: string }>).map(
        (row) => ({
          id: row.id,
          index: row.idx,
          startMs: row.start_ms,
          text: row.text,
          speaker: row.speaker,
        }),
      );
    });
    if (transcript.length === 0) throw new Error("There is no transcript to summarize yet.");

    let templateName: string | undefined;
    if (data.templateId) {
      const rows = await withTenant(ctx, async (tx) =>
        tx.select({ name: templates.name }).from(templates).where(eq(templates.id, data.templateId!)).limit(1),
      );
      templateName = rows[0]?.name;
    }

    const summary = await summarize({
      segments: transcript,
      meetingTitle: meeting.title,
      template: templateName,
      length: data.length,
      override: await resolveProviderOverride(data.orgId, "llm"),
    });

    // A workspace can turn AI action items off without turning off summaries.
    const policy = await workspaceRepo.getAiPolicy({
      orgId: data.orgId,
      userId: "00000000-0000-0000-0000-000000000000",
    });
    const actionItemsEnabled = policy.featureGates.actionItems;
    const summarySections = policy.featureGates.summaries
      ? summary.sections
      : summary.sections.filter((section) => section.key !== "action_items");

    const segmentIdByIndex = new Map(transcript.map((line) => [line.index, line.id]));
    const startByIndex = new Map(transcript.map((line) => [line.index, line.startMs]));

    await withTenant(ctx, async (tx) => {
      const current = await tx.select({ version: notes.version }).from(notes).where(eq(notes.id, note.id)).limit(1);
      if (!current[0] || current[0].version !== note.version) {
        // A human edited the note while the model was running; keep their version.
        return;
      }

      await tx.delete(noteSections).where(eq(noteSections.noteId, note.id));
      const insertedSections = await tx
        .insert(noteSections)
        .values(
          summarySections.map((section, index) => ({
            orgId: data.orgId,
            noteId: note.id,
            key: section.key.slice(0, 60),
            title: section.title.slice(0, 120),
            bodyMarkdown: section.body,
            orderIndex: index,
            source: "ai",
          })),
        )
        .returning({ id: noteSections.id, key: noteSections.key });

      const sectionIdByKey = new Map(insertedSections.map((section) => [section.key, section.id]));
      const citationRows = summary.citations
        .map((citation: SummaryCitation) => {
          const segmentId = segmentIdByIndex.get(citation.segmentIndex);
          if (!segmentId) return null;
          return {
            orgId: data.orgId,
            noteId: note.id,
            sectionId: sectionIdByKey.get(citation.sectionKey) ?? null,
            segmentId,
            quote: citation.quote.slice(0, 2000),
            startMs: startByIndex.get(citation.segmentIndex) ?? 0,
            origin: "ai" as const,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
      if (citationRows.length > 0) await tx.insert(citations).values(citationRows);

      await tx
        .update(notes)
        .set({ status: "ready", model: summary.model, generatedAt: new Date() })
        .where(eq(notes.id, note.id));

      await tx.delete(actionItems).where(
        and(eq(actionItems.meetingId, data.meetingId), sql`${actionItems.sourceSegmentId} is not null`),
      );
      if (actionItemsEnabled && summary.actionItems.length > 0) {
        await tx.insert(actionItems).values(
          summary.actionItems.slice(0, 50).map((item) => ({
            orgId: data.orgId,
            meetingId: data.meetingId,
            text: item.text.slice(0, 2000),
            assigneeName: item.assigneeName ?? null,
            dueAt: item.dueAt ? new Date(item.dueAt) : null,
            sourceSegmentId:
              item.sourceSegmentIndex != null ? (segmentIdByIndex.get(item.sourceSegmentIndex) ?? null) : null,
            status: "open",
          })),
        );
      }

      await tx.update(meetings).set({ status: "ready" }).where(eq(meetings.id, data.meetingId));
    });

    await recordUsage(data.orgId, {
      tokensIn: summary.usage.inputTokens,
      tokensOut: summary.usage.outputTokens,
    });
    return { orgId: data.orgId, meetingId: data.meetingId };
  } catch (error) {
    await withTenant(ctx, async (tx) => {
      await tx.update(notes).set({ status: "failed" }).where(eq(notes.id, note.id));
      await tx
        .update(meetings)
        .set({ status: "failed", failureReason: error instanceof Error ? error.message.slice(0, 500) : "Summary failed" })
        .where(eq(meetings.id, data.meetingId));
    });
    throw error;
  }
}

export async function embedJob(data: EmbedJobData): Promise<JobOutcome> {
  const ctx = { orgId: data.orgId, userId: "00000000-0000-0000-0000-000000000000" };
  // A workspace can bring its own embedding provider, so the env switch is
  // only the fallback.
  const embeddingOverride = await resolveProviderOverride(data.orgId, "embedding");
  if (!embeddingOverride && !aiConfig().embeddings.enabled) {
    return { orgId: data.orgId, meetingId: data.meetingId };
  }

  const segments = await withTenant(ctx, async (tx) => {
    const rows = await tx.execute(sql`
      select s.id, s.text
      from transcript_segments s
      join transcripts t on t.id = s.transcript_id
      where t.meeting_id = ${data.meetingId}
      order by s.idx
    `);
    return rows.rows as Array<{ id: string; text: string }>;
  });
  if (segments.length === 0) return { orgId: data.orgId, meetingId: data.meetingId };

  const vectors: number[][] = [];
  for (let offset = 0; offset < segments.length; offset += 64) {
    const batch = segments.slice(offset, offset + 64);
    const result = await embedTexts(batch.map((segment) => segment.text), embeddingOverride);
    if (!result) return { orgId: data.orgId, meetingId: data.meetingId };
    vectors.push(...result);
  }

  await withTenant(ctx, async (tx) => {
    const ids = segments.map((segment) => segment.id);
    await tx
      .delete(embeddings)
      .where(and(eq(embeddings.orgId, data.orgId), eq(embeddings.objectType, "segment"), inArray(embeddings.objectId, ids)));
    for (let offset = 0; offset < segments.length; offset += 200) {
      const rows = segments.slice(offset, offset + 200).map((segment, index) => ({
        orgId: data.orgId,
        objectType: "segment",
        objectId: segment.id,
        model: embeddingOverride?.model ?? aiConfig().embeddings.model,
        embedding: vectors[offset + index],
      }));
      await tx.insert(embeddings).values(rows);
    }
  });

  return { orgId: data.orgId, meetingId: data.meetingId };
}

export async function emailJob(data: EmailJobData): Promise<JobOutcome> {
  const content: EmailContent = { subject: data.subject, text: data.text, html: data.html };
  await sendMail({ to: data.to, content });
  return { orgId: "system" };
}

/** Pulls the next two weeks of events and queues bots for the meetings that need one. */
export async function calendarSyncJob(data: CalendarSyncJobData): Promise<JobOutcome> {
  const { syncCalendarConnection } = await import("./calendarSync");
  const { enqueue } = await import("./queue");
  const result = await syncCalendarConnection(data.orgId, data.connectionId, {
    queueBot: async ({ orgId, botJobId }) => {
      await enqueue("bot", { orgId, botJobId });
    },
  });
  if (result.error) throw new Error(result.error);
  return { orgId: data.orgId };
}

/** Asks the bot service to join a meeting. */
export async function botJoinJob(data: BotJoinJobData): Promise<JobOutcome> {
  const { botsRepo, workspaceRepo } = await import("@click/db");
  const { requestBotJoin, callbackBaseUrl } = await import("./botService");
  const ctx = { orgId: data.orgId, userId: "00000000-0000-0000-0000-000000000000" };
  const job = await botsRepo.getBotJob(ctx, data.botJobId);
  if (!job) throw new Error("Bot job not found.");
  if (job.state === "active" || job.state === "completed" || job.state === "cancelled") {
    return { orgId: data.orgId, meetingId: job.meetingId };
  }

  await botsRepo.updateBotJobState(
    { id: job.id, orgId: data.orgId, meetingId: job.meetingId },
    { state: "joining" },
  );

  const notice = await workspaceRepo.getBotNotice(ctx);
  const result = await requestBotJoin({
    botJobId: job.id,
    meetingId: job.meetingId,
    provider: job.provider,
    meetingUrl: job.meetingUrl,
    botName: job.botName,
    consentNotice: notice,
    callbackBaseUrl: callbackBaseUrl(),
  });
  if (!result.ok) {
    await botsRepo.failBotJob(ctx, job.id, result.error ?? "bot_join_failed");
    throw new Error(result.error ?? "The bot could not join the meeting.");
  }
  return { orgId: data.orgId, meetingId: job.meetingId };
}

export async function runJob(payload: JobPayload): Promise<JobOutcome> {
  switch (payload.name) {
    case "transcribe":
      return transcribeJob(payload.data);
    case "summarize":
      return summarizeJob(payload.data);
    case "embed":
      return embedJob(payload.data);
    case "email":
      return emailJob(payload.data);
    case "calendar-sync":
      return calendarSyncJob(payload.data);
    case "bot-join":
      return botJoinJob(payload.data);
  }
}

/** Used by the retry route to re-run the pipeline from a chosen stage. */
export async function retryMeeting(orgId: string, meetingId: string, stage: "transcribe" | "summarize") {
  if (stage === "transcribe") {
    const recording = await withTenant({ orgId, userId: "00000000-0000-0000-0000-000000000000" }, async (tx) => {
      const rows = await tx
        .select({ id: recordings.id })
        .from(recordings)
        .where(and(eq(recordings.meetingId, meetingId), sql`${recordings.deletedAt} is null`))
        .orderBy(asc(recordings.createdAt))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!recording) throw new Error("This meeting has no stored recording to retry.");
    return transcribeJob({ orgId, meetingId, recordingId: recording.id });
  }
  return summarizeJob({ orgId, meetingId });
}
