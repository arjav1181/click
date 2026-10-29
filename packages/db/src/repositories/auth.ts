import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { withAuth } from "../client";
import {
  authIdentities,
  authTokens,
  invitations,
  memberships,
  organizations,
  sessions,
  users,
} from "../schema";
import { randomToken, sha256 } from "../password";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  emailVerifiedAt: string | null;
  orgId: string | null;
  orgName: string | null;
  orgSlug: string | null;
  role: "owner" | "admin" | "member" | null;
}

const SESSION_DAYS = 30;
const MAGIC_LINK_MINUTES = 15;
const RESET_MINUTES = 60;

function mapUser(row: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  emailVerifiedAt: Date | null;
  orgId?: string | null;
  orgName?: string | null;
  orgSlug?: string | null;
  role?: string | null;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    locale: row.locale,
    timezone: row.timezone,
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    orgId: row.orgId ?? null,
    orgName: row.orgName ?? null,
    orgSlug: row.orgSlug ?? null,
    role: (row.role as AuthUser["role"]) ?? null,
  };
}

export async function findUserByEmail(email: string) {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
        avatarUrl: users.avatarUrl,
        locale: users.locale,
        timezone: users.timezone,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function findUserById(id: string) {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        locale: users.locale,
        timezone: users.timezone,
        emailVerifiedAt: users.emailVerifiedAt,
        orgId: memberships.orgId,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        role: memberships.role,
      })
      .from(users)
      .leftJoin(memberships, eq(memberships.userId, users.id))
      .leftJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(eq(users.id, id))
      // A user can belong to more than one workspace; the newest membership
      // wins so accepting an invitation switches the active workspace.
      .orderBy(desc(memberships.createdAt))
      .limit(1);
    return rows[0] ? mapUser(rows[0]) : null;
  });
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  orgName?: string;
}) {
  return withAuth(async (tx) => {
    const slugBase =
      (input.orgName ?? input.email.split("@")[1] ?? "workspace")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "workspace";
    const existingSlug = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slugBase))
      .limit(1);

    const userRows = await tx
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
        emailVerifiedAt: new Date(),
      })
      .returning();
    const user = userRows[0];

    const orgRows = await tx
      .insert(organizations)
      .values({
        name: input.orgName ?? `${input.name.split(" ")[0]}'s workspace`,
        slug: existingSlug.length > 0 ? `${slugBase}-${randomToken(3).slice(0, 4).toLowerCase()}` : slugBase,
      })
      .returning();
    const org = orgRows[0];

    await tx.insert(memberships).values({ orgId: org.id, userId: user.id, role: "owner", status: "active" });
    await tx.insert(authIdentities).values({
      userId: user.id,
      provider: "password",
      subject: user.email,
    });

    return {
      user: mapUser({ ...user, orgId: org.id, orgName: org.name, orgSlug: org.slug, role: "owner" }),
      orgId: org.id,
    };
  });
}

export async function createSession(input: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}) {
  return withAuth(async (tx) => {
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await tx.insert(sessions).values({
      userId: input.userId,
      tokenHash: sha256(token),
      userAgent: input.userAgent?.slice(0, 400) ?? null,
      ip: input.ip ?? null,
      expiresAt,
    });
    return { token, expiresAt };
  });
}

export async function resolveSession(token: string) {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        locale: users.locale,
        timezone: users.timezone,
        emailVerifiedAt: users.emailVerifiedAt,
        orgId: memberships.orgId,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        role: memberships.role,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .leftJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.status, "active")))
      .leftJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
      // Newest membership wins so accepting an invitation switches workspace.
      .orderBy(desc(memberships.createdAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    await tx.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, row.id));
    return mapUser(row);
  });
}

export async function deleteSession(token: string) {
  return withAuth(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  });
}

export async function deleteAllSessions(userId: string) {
  return withAuth(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
}

export async function createAuthToken(userId: string, kind: "magic_link" | "password_reset" | "email_verify") {
  return withAuth(async (tx) => {
    const token = randomToken(32);
    const minutes = kind === "password_reset" ? RESET_MINUTES : MAGIC_LINK_MINUTES;
    await tx.insert(authTokens).values({
      userId,
      kind,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + minutes * 60 * 1000),
    });
    return { token, minutes };
  });
}

export async function consumeAuthToken(token: string, kind: "magic_link" | "password_reset" | "email_verify") {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({ id: authTokens.id, userId: authTokens.userId, expiresAt: authTokens.expiresAt })
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, sha256(token)),
          eq(authTokens.kind, kind),
          isNull(authTokens.consumedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    await tx.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, row.id));
    return row.userId;
  });
}

export async function setPassword(userId: string, passwordHash: string) {
  return withAuth(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
}

export async function listMemberships(userId: string) {
  return withAuth(async (tx) => {
    return tx
      .select({
        orgId: memberships.orgId,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        role: memberships.role,
        status: memberships.status,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")))
      .orderBy(desc(memberships.createdAt));
  });
}

export async function createInvitation(input: {
  orgId: string;
  email: string;
  role: "owner" | "admin" | "member";
  invitedBy: string;
}) {
  return withAuth(async (tx) => {
    const token = randomToken(32);
    await tx.insert(invitations).values({
      orgId: input.orgId,
      email: input.email.toLowerCase(),
      role: input.role,
      tokenHash: sha256(token),
      invitedBy: input.invitedBy,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return { token };
  });
}

export async function acceptInvitation(token: string, userId: string) {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({ id: invitations.id, orgId: invitations.orgId, role: invitations.role })
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, sha256(token)),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const invite = rows[0];
    if (!invite) return null;
    await tx
      .insert(memberships)
      .values({ orgId: invite.orgId, userId, role: invite.role, status: "active" })
      .onConflictDoUpdate({
        target: [memberships.orgId, memberships.userId],
        set: { status: "active" },
      });
    await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invite.id));
    return { orgId: invite.orgId };
  });
}

export async function countUsers() {
  return withAuth(async (tx) => {
    const rows = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
    return rows[0]?.n ?? 0;
  });
}

/** Creates a user without a workspace; used when accepting an invitation. */
export async function createUserAccount(input: {
  email: string;
  name: string;
  passwordHash: string;
  emailVerifiedAt?: Date | null;
}) {
  return withAuth(async (tx) => {
    const rows = await tx
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
      })
      .returning();
    const user = rows[0];
    await tx.insert(authIdentities).values({
      userId: user.id,
      provider: "password",
      subject: user.email,
    });
    return mapUser({ ...user, orgId: null, orgName: null, orgSlug: null, role: null });
  });
}

export async function markEmailVerified(userId: string) {
  return withAuth(async (tx) => {
    await tx
      .update(users)
      .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
      .where(eq(users.id, userId));
  });
}

export async function previewInvitation(token: string) {
  return withAuth(async (tx) => {
    const rows = await tx
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        orgId: invitations.orgId,
        orgName: organizations.name,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
      })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.orgId))
      .where(eq(invitations.tokenHash, sha256(token)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.acceptedAt || row.expiresAt.getTime() <= Date.now()) return null;
    return row;
  });
}
