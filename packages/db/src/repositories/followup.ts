import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { emailDrafts, meetings } from "../schema";

export interface EmailDraftRow {
  id: string;
  meetingId: string;
  toAddrs: string[];
  ccAddrs: string[];
  bccAddrs: string[];
  subject: string;
  body: string;
  attachments: Array<{ name: string; url: string }>;
  status: "draft" | "sending" | "sent" | "failed" | "expired";
  expiresAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getOrCreateDraft(ctx: TenantContext, meetingId: string): Promise<EmailDraftRow> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(emailDrafts)
      .where(and(eq(emailDrafts.orgId, ctx.orgId), eq(emailDrafts.meetingId, meetingId), eq(emailDrafts.userId, ctx.userId)))
      .orderBy(desc(emailDrafts.createdAt))
      .limit(1);
    if (existing[0]) {
      return mapDraft(existing[0]);
    }
    const meeting = await tx
      .select({ title: meetings.title })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);
    const title = meeting[0]?.title ?? "Meeting";
    const rows = await tx
      .insert(emailDrafts)
      .values({
        orgId: ctx.orgId,
        meetingId,
        userId: ctx.userId,
        subject: `Follow-up: ${title}`,
        body: "",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning();
    return mapDraft(rows[0]);
  });
}

export async function updateDraft(
  ctx: TenantContext,
  id: string,
  patch: {
    toAddrs?: string[];
    ccAddrs?: string[];
    bccAddrs?: string[];
    subject?: string;
    body?: string;
    attachments?: Array<{ name: string; url: string }>;
  },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: emailDrafts.id, status: emailDrafts.status })
      .from(emailDrafts)
      .where(and(eq(emailDrafts.id, id), eq(emailDrafts.orgId, ctx.orgId), eq(emailDrafts.userId, ctx.userId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    if (rows[0].status === "sent" || rows[0].status === "expired") return { ok: false };
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.toAddrs !== undefined) values.toAddrs = patch.toAddrs;
    if (patch.ccAddrs !== undefined) values.ccAddrs = patch.ccAddrs;
    if (patch.bccAddrs !== undefined) values.bccAddrs = patch.bccAddrs;
    if (patch.subject !== undefined) values.subject = patch.subject.slice(0, 300);
    if (patch.body !== undefined) values.body = patch.body.slice(0, 50000);
    if (patch.attachments !== undefined) values.attachments = patch.attachments;
    await tx.update(emailDrafts).set(values).where(eq(emailDrafts.id, id));
    return { ok: true };
  });
}

export async function markDraftSent(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: emailDrafts.id })
      .from(emailDrafts)
      .where(and(eq(emailDrafts.id, id), eq(emailDrafts.orgId, ctx.orgId), eq(emailDrafts.userId, ctx.userId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    await tx
      .update(emailDrafts)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(emailDrafts.id, id));
    return { ok: true };
  });
}

function mapDraft(row: typeof emailDrafts.$inferSelect): EmailDraftRow {
  return {
    id: row.id,
    meetingId: row.meetingId,
    toAddrs: row.toAddrs ?? [],
    ccAddrs: row.ccAddrs ?? [],
    bccAddrs: row.bccAddrs ?? [],
    subject: row.subject,
    body: row.body,
    attachments: (row.attachments ?? []) as Array<{ name: string; url: string }>,
    status: row.status as EmailDraftRow["status"],
    expiresAt: row.expiresAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
