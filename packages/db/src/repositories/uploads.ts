import { and, asc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { uploadChunks, uploadSessions } from "../schema";

export interface UploadSessionRow {
  id: string;
  orgId: string;
  userId: string;
  meetingId: string | null;
  title: string;
  mime: string;
  codec: string;
  storageKey: string;
  storageUploadId: string | null;
  chunkSize: number;
  totalBytes: number | null;
  receivedBytes: number;
  state: string;
  createdAt: string;
}

export interface UploadChunkRow {
  chunkIndex: number;
  sizeBytes: number;
  etag: string | null;
}

function map(row: typeof uploadSessions.$inferSelect): UploadSessionRow {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    meetingId: row.meetingId,
    title: row.title,
    mime: row.mime,
    codec: row.codec,
    storageKey: row.storageKey,
    storageUploadId: row.storageUploadId,
    chunkSize: row.chunkSize,
    totalBytes: row.totalBytes,
    receivedBytes: row.receivedBytes,
    state: row.state,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createUploadSession(
  ctx: TenantContext,
  input: {
    meetingId: string;
    title: string;
    mime: string;
    codec: string;
    storageKey: string;
    storageUploadId: string | null;
    chunkSize: number;
    totalBytes?: number | null;
  },
): Promise<UploadSessionRow> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(uploadSessions)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        meetingId: input.meetingId,
        title: input.title.slice(0, 300),
        mime: input.mime,
        codec: input.codec,
        storageKey: input.storageKey,
        storageUploadId: input.storageUploadId,
        chunkSize: input.chunkSize,
        totalBytes: input.totalBytes ?? null,
      })
      .returning();
    return map(rows[0]);
  });
}

export async function getUploadSession(
  ctx: TenantContext,
  id: string,
): Promise<UploadSessionRow | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(uploadSessions)
      .where(and(eq(uploadSessions.id, id), eq(uploadSessions.orgId, ctx.orgId)))
      .limit(1);
    return rows[0] ? map(rows[0]) : null;
  });
}

/**
 * Records a chunk and refreshes the byte counter. Re-sending a chunk replaces
 * the old row, so the client can retry a chunk it is not sure about.
 */
export async function recordUploadChunk(
  ctx: TenantContext,
  input: { uploadId: string; chunkIndex: number; sizeBytes: number; etag?: string | null },
): Promise<number> {
  return withTenant(ctx, async (tx) => {
    await tx
      .insert(uploadChunks)
      .values({
        orgId: ctx.orgId,
        uploadId: input.uploadId,
        chunkIndex: input.chunkIndex,
        sizeBytes: input.sizeBytes,
        etag: input.etag ?? null,
      })
      .onConflictDoUpdate({
        target: [uploadChunks.uploadId, uploadChunks.chunkIndex],
        set: { sizeBytes: input.sizeBytes, etag: input.etag ?? null },
      });
    const totals = await tx
      .select({ total: sql<number>`coalesce(sum(${uploadChunks.sizeBytes}), 0)` })
      .from(uploadChunks)
      .where(eq(uploadChunks.uploadId, input.uploadId));
    const total = Number(totals[0]?.total ?? 0);
    await tx
      .update(uploadSessions)
      .set({ receivedBytes: total })
      .where(and(eq(uploadSessions.id, input.uploadId), eq(uploadSessions.orgId, ctx.orgId)));
    return total;
  });
}

export async function listUploadChunks(
  ctx: TenantContext,
  uploadId: string,
): Promise<UploadChunkRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        chunkIndex: uploadChunks.chunkIndex,
        sizeBytes: uploadChunks.sizeBytes,
        etag: uploadChunks.etag,
      })
      .from(uploadChunks)
      .where(and(eq(uploadChunks.uploadId, uploadId), eq(uploadChunks.orgId, ctx.orgId)))
      .orderBy(asc(uploadChunks.chunkIndex));
    return rows.map((row) => ({
      chunkIndex: row.chunkIndex,
      sizeBytes: row.sizeBytes,
      etag: row.etag,
    }));
  });
}

export async function markUploadSession(
  ctx: TenantContext,
  id: string,
  state: "completed" | "aborted",
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx
      .update(uploadSessions)
      .set({ state })
      .where(and(eq(uploadSessions.id, id), eq(uploadSessions.orgId, ctx.orgId)));
  });
}
