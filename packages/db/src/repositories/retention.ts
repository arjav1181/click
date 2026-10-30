import { eq } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { retentionPolicies } from "../schema";

export interface RetentionPolicyRow {
  transcriptDays: number | null;
  audioDays: number | null;
  recordingMode: "audio" | "audio_video" | "transcript_only";
  legalHoldOverride: boolean;
  updatedAt: string | null;
}

export async function getRetentionPolicy(ctx: TenantContext): Promise<RetentionPolicyRow> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        transcriptDays: retentionPolicies.transcriptDays,
        audioDays: retentionPolicies.audioDays,
        recordingMode: retentionPolicies.recordingMode,
        legalHoldOverride: retentionPolicies.legalHoldOverride,
        updatedAt: retentionPolicies.updatedAt,
      })
      .from(retentionPolicies)
      .where(eq(retentionPolicies.orgId, ctx.orgId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return {
        transcriptDays: null,
        audioDays: null,
        recordingMode: "audio",
        legalHoldOverride: false,
        updatedAt: null,
      };
    }
    return {
      transcriptDays: row.transcriptDays,
      audioDays: row.audioDays,
      recordingMode: row.recordingMode as RetentionPolicyRow["recordingMode"],
      legalHoldOverride: row.legalHoldOverride,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function upsertRetentionPolicy(
  ctx: TenantContext,
  patch: {
    transcriptDays?: number | null;
    audioDays?: number | null;
    recordingMode?: "audio" | "audio_video" | "transcript_only";
    legalHoldOverride?: boolean;
  },
): Promise<RetentionPolicyRow> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx
      .select({ id: retentionPolicies.id })
      .from(retentionPolicies)
      .where(eq(retentionPolicies.orgId, ctx.orgId))
      .limit(1);

    const values = {
      transcriptDays: patch.transcriptDays,
      audioDays: patch.audioDays,
      recordingMode: patch.recordingMode,
      legalHoldOverride: patch.legalHoldOverride,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    if (existing[0]) {
      const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: ctx.userId };
      if (patch.transcriptDays !== undefined) set.transcriptDays = patch.transcriptDays;
      if (patch.audioDays !== undefined) set.audioDays = patch.audioDays;
      if (patch.recordingMode !== undefined) set.recordingMode = patch.recordingMode;
      if (patch.legalHoldOverride !== undefined) set.legalHoldOverride = patch.legalHoldOverride;
      await tx.update(retentionPolicies).set(set).where(eq(retentionPolicies.orgId, ctx.orgId));
    } else {
      await tx.insert(retentionPolicies).values({
        orgId: ctx.orgId,
        transcriptDays: patch.transcriptDays ?? null,
        audioDays: patch.audioDays ?? null,
        recordingMode: patch.recordingMode ?? "audio",
        legalHoldOverride: patch.legalHoldOverride ?? false,
        updatedBy: ctx.userId,
      });
    }

    const rows = await tx
      .select({
        transcriptDays: retentionPolicies.transcriptDays,
        audioDays: retentionPolicies.audioDays,
        recordingMode: retentionPolicies.recordingMode,
        legalHoldOverride: retentionPolicies.legalHoldOverride,
        updatedAt: retentionPolicies.updatedAt,
      })
      .from(retentionPolicies)
      .where(eq(retentionPolicies.orgId, ctx.orgId))
      .limit(1);
    const row = rows[0];
    return {
      transcriptDays: row.transcriptDays,
      audioDays: row.audioDays,
      recordingMode: row.recordingMode as RetentionPolicyRow["recordingMode"],
      legalHoldOverride: row.legalHoldOverride,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}
