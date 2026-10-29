import { and, asc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { citations, noteSections, notes } from "../schema";

export interface NotePayload {
  id: string;
  meetingId: string;
  rawMarkdown: string;
  enhancedStatus: string;
  templateId: string | null;
  model: string | null;
  generatedAt: string | null;
  version: number;
  sections: Array<{ id: string; key: string; title: string; body: string; orderIndex: number; source: string }>;
  citations: Array<{
    id: string;
    sectionId: string | null;
    segmentId: string | null;
    quote: string;
    startMs: number | null;
    origin: string;
    label: string | null;
  }>;
}

export async function getNote(ctx: TenantContext, meetingId: string): Promise<NotePayload | null> {
  return withTenant(ctx, async (tx) => {
    const noteRows = await tx
      .select()
      .from(notes)
      .where(eq(notes.meetingId, meetingId))
      .orderBy(asc(notes.createdAt))
      .limit(1);
    const note = noteRows[0];
    if (!note) return null;

    const sections = await tx
      .select()
      .from(noteSections)
      .where(eq(noteSections.noteId, note.id))
      .orderBy(asc(noteSections.orderIndex));

    const cites = await tx
      .select()
      .from(citations)
      .where(eq(citations.noteId, note.id));

    return {
      id: note.id,
      meetingId: note.meetingId,
      rawMarkdown: note.rawMarkdown,
      enhancedStatus: note.status,
      templateId: note.templateId,
      model: note.model,
      generatedAt: note.generatedAt?.toISOString() ?? null,
      version: note.version,
      sections: sections.map((s) => ({
        id: s.id,
        key: s.key,
        title: s.title,
        body: s.bodyMarkdown,
        orderIndex: s.orderIndex,
        source: s.source,
      })),
      citations: cites.map((c) => ({
        id: c.id,
        sectionId: c.sectionId,
        segmentId: c.segmentId,
        quote: c.quote,
        startMs: c.startMs,
        origin: c.origin,
        label: c.label,
      })),
    };
  });
}

export async function upsertRawNote(ctx: TenantContext, meetingId: string, rawMarkdown: string) {
  return withTenant(ctx, async (tx) => {
    const existing = await tx
      .select({ id: notes.id, version: notes.version })
      .from(notes)
      .where(and(eq(notes.meetingId, meetingId), eq(notes.authorId, ctx.userId)))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(notes)
        .set({ rawMarkdown: rawMarkdown.slice(0, 200_000), version: existing[0].version + 1, editedAt: new Date() })
        .where(eq(notes.id, existing[0].id));
      return existing[0].id;
    }

    const inserted = await tx
      .insert(notes)
      .values({
        orgId: ctx.orgId,
        meetingId,
        authorId: ctx.userId,
        rawMarkdown: rawMarkdown.slice(0, 200_000),
      })
      .returning({ id: notes.id });
    return inserted[0].id;
  });
}

/** Marks a note as generating; the worker fills it in later. */
export async function markNoteGenerating(ctx: TenantContext, meetingId: string, templateId: string | null) {
  return withTenant(ctx, async (tx) => {
    const existing = await tx
      .select({ id: notes.id, version: notes.version })
      .from(notes)
      .where(eq(notes.meetingId, meetingId))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(notes)
        .set({ status: "generating", templateId, version: existing[0].version + 1 })
        .where(eq(notes.id, existing[0].id));
      return { noteId: existing[0].id, version: existing[0].version + 1 };
    }

    const inserted = await tx
      .insert(notes)
      .values({
        orgId: ctx.orgId,
        meetingId,
        authorId: ctx.userId,
        status: "generating",
        templateId,
      })
      .returning({ id: notes.id });
    return { noteId: inserted[0].id, version: 1 };
  });
}

export async function writeGeneratedNote(input: {
  orgId: string;
  noteId: string;
  expectedVersion: number;
  model: string;
  sections: Array<{ key: string; title: string; body: string; source?: "ai" | "template" | "custom" }>;
  citations: Array<{ sectionKey?: string; segmentId: string; quote: string; startMs: number; origin?: "ai" | "human"; label?: string }>;
}) {
  return withTenant({ orgId: input.orgId, userId: "00000000-0000-0000-0000-000000000000" }, async (tx) => {
    const current = await tx
      .select({ version: notes.version })
      .from(notes)
      .where(eq(notes.id, input.noteId))
      .limit(1);
    if (!current[0] || current[0].version !== input.expectedVersion) {
      // A newer edit won the race; discard the late worker result.
      return false;
    }

    await tx.delete(noteSections).where(eq(noteSections.noteId, input.noteId));
    const insertedSections = await tx
      .insert(noteSections)
      .values(
        input.sections.map((section, index) => ({
          orgId: input.orgId,
          noteId: input.noteId,
          key: section.key,
          title: section.title,
          bodyMarkdown: section.body,
          orderIndex: index,
          source: section.source ?? "ai",
        })),
      )
      .returning({ id: noteSections.id, key: noteSections.key });

    const byKey = new Map(insertedSections.map((s) => [s.key, s.id]));
    if (input.citations.length > 0) {
      await tx.insert(citations).values(
        input.citations.map((c) => ({
          orgId: input.orgId,
          noteId: input.noteId,
          sectionId: c.sectionKey ? (byKey.get(c.sectionKey) ?? null) : null,
          segmentId: c.segmentId,
          quote: c.quote.slice(0, 2000),
          startMs: c.startMs,
          origin: c.origin ?? "ai",
          label: c.label ?? null,
        })),
      );
    }

    await tx
      .update(notes)
      .set({ status: "ready", model: input.model, generatedAt: new Date() })
      .where(eq(notes.id, input.noteId));
    return true;
  });
}

export async function failNote(orgId: string, noteId: string) {
  return withTenant({ orgId, userId: "00000000-0000-0000-0000-000000000000" }, async (tx) => {
    await tx.update(notes).set({ status: "failed" }).where(eq(notes.id, noteId));
  });
}

export async function listTemplates(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.execute(sql`
      select id, name, description, sections, scope, is_builtin
      from templates
      where org_id = ${ctx.orgId} or (org_id is null and is_builtin)
      order by is_builtin desc, name
    `);
    return (rows.rows as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: r.description ? String(r.description) : "",
      sections: r.sections,
      scope: String(r.scope),
      isBuiltin: Boolean(r.is_builtin),
    }));
  });
}
