import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withAuth, withTenant, type TenantContext } from "../client";
import { meetings, publicShares, users } from "../schema";
import { randomToken, sha256 } from "../password";

export interface PublicShareRow {
  id: string;
  meetingId: string;
  access: "link" | "domain" | "password";
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface ResolvedShare {
  shareId: string;
  orgId: string;
  meetingId: string;
  access: "link" | "domain" | "password";
  hasPassword: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
}

export async function listShares(ctx: TenantContext, meetingId: string): Promise<PublicShareRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: publicShares.id,
        meetingId: publicShares.meetingId,
        access: publicShares.access,
        expiresAt: publicShares.expiresAt,
        revokedAt: publicShares.revokedAt,
        createdBy: publicShares.createdBy,
        createdByName: users.name,
        createdAt: publicShares.createdAt,
      })
      .from(publicShares)
      .leftJoin(users, eq(users.id, publicShares.createdBy))
      .where(and(eq(publicShares.orgId, ctx.orgId), eq(publicShares.meetingId, meetingId)))
      .orderBy(desc(publicShares.createdAt));
    return rows.map((row) => ({
      id: row.id,
      meetingId: row.meetingId,
      access: row.access as PublicShareRow["access"],
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      createdByName: row.createdByName ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function createShare(
  ctx: TenantContext,
  input: {
    meetingId: string;
    access: "link" | "domain" | "password";
    password?: string | null;
    expiresAt?: Date | null;
  },
): Promise<{ id: string; token: string }> {
  const token = randomToken(32);
  const tokenHash = sha256(token);
  let passwordHash: string | null = null;
  if (input.access === "password" && input.password) {
    passwordHash = sha256(input.password);
  }
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(publicShares)
      .values({
        orgId: ctx.orgId,
        meetingId: input.meetingId,
        tokenHash,
        access: input.access,
        passwordHash,
        expiresAt: input.expiresAt ?? null,
        createdBy: ctx.userId,
      })
      .returning({ id: publicShares.id });
    return { id: rows[0].id, token };
  });
}

export async function revokeShare(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: publicShares.id })
      .from(publicShares)
      .where(and(eq(publicShares.id, id), eq(publicShares.orgId, ctx.orgId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    await tx
      .update(publicShares)
      .set({ revokedAt: new Date() })
      .where(eq(publicShares.id, id));
    return { ok: true };
  });
}

/**
 * Resolves a raw share token to its metadata. Runs as the auth role because
 * the public recap page has no tenant context yet.
 */
export async function resolveShare(token: string): Promise<ResolvedShare | null> {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({
        id: publicShares.id,
        orgId: publicShares.orgId,
        meetingId: publicShares.meetingId,
        access: publicShares.access,
        passwordHash: publicShares.passwordHash,
        expiresAt: publicShares.expiresAt,
        revokedAt: publicShares.revokedAt,
      })
      .from(publicShares)
      .where(eq(publicShares.tokenHash, sha256(token)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      shareId: row.id,
      orgId: row.orgId,
      meetingId: row.meetingId,
      access: row.access as ResolvedShare["access"],
      hasPassword: Boolean(row.passwordHash),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  });
}

export async function verifySharePassword(token: string, password: string): Promise<boolean> {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({ passwordHash: publicShares.passwordHash })
      .from(publicShares)
      .where(eq(publicShares.tokenHash, sha256(token)))
      .limit(1);
    const row = rows[0];
    if (!row?.passwordHash) return true;
    return row.passwordHash === sha256(password);
  });
}
