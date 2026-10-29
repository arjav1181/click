import { cookies } from "next/headers";
import {
  authRepo,
  hashPassword,
  passwordProblem,
  verifyPassword,
  type AuthUser,
} from "@click/db";
import {
  appUrl,
  invitation as invitationEmail,
  magicLink as magicLinkEmail,
  resetPassword as resetEmail,
  sendMail,
  sessionCookieName,
  verifyEmail as verifyEmailTemplate,
} from "@click/backend";
import { ApiError } from "./http";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(sessionCookieName())?.value ?? null;
}

export async function getSession(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return authRepo.resolveSession(token);
}

export async function requireSession(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) {
    throw new ApiError(401, "unauthenticated", "Sign in to continue.");
  }
  return session;
}

export interface OrgSession extends AuthUser {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: "owner" | "admin" | "member";
}

export async function requireOrgSession(): Promise<OrgSession> {
  const session = await requireSession();
  if (!session.orgId || !session.orgName || !session.orgSlug || !session.role) {
    throw new ApiError(403, "no_workspace", "This account is not a member of a workspace yet.");
  }
  return session as OrgSession;
}

export function requireRole(session: OrgSession, roles: Array<"owner" | "admin" | "member">) {
  if (!roles.includes(session.role)) {
    throw new ApiError(403, "forbidden", "Your role does not allow this action.");
  }
}

let dummyHash: string | null = null;
async function timingHash() {
  if (!dummyHash) dummyHash = await hashPassword("click-timing-equalizer-not-a-password");
  return dummyHash;
}

export interface LoginResult {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<LoginResult | null> {
  const user = await authRepo.findUserByEmail(input.email);
  const stored = user?.passwordHash ?? (await timingHash());
  const valid = await verifyPassword(input.password, stored);
  if (!user || !valid) return null;
  const session = await authRepo.createSession({
    userId: user.id,
    userAgent: input.userAgent,
    ip: input.ip,
  });
  const full = (await authRepo.findUserById(user.id)) ?? {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    timezone: user.timezone,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    orgId: null,
    orgName: null,
    orgSlug: null,
    role: null,
  };
  return { user: full, token: session.token, expiresAt: session.expiresAt };
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  orgName?: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<LoginResult> {
  const problem = passwordProblem(input.password);
  if (problem) throw new ApiError(422, "weak_password", problem);

  const existing = await authRepo.findUserByEmail(input.email);
  if (existing) {
    throw new ApiError(409, "email_taken", "An account with this email already exists. Sign in instead.");
  }

  const created = await authRepo.createUser({
    email: input.email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
    orgName: input.orgName,
  });
  const session = await authRepo.createSession({
    userId: created.user.id,
    userAgent: input.userAgent,
    ip: input.ip,
  });
  await sendVerificationEmail(created.user.id, created.user.email, created.user.name);
  return { user: created.user, token: session.token, expiresAt: session.expiresAt };
}

export async function sendVerificationEmail(userId: string, email: string, name: string) {
  try {
    const { token } = await authRepo.createAuthToken(userId, "email_verify");
    const url = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    await sendMail({ to: email, content: verifyEmailTemplate({ name, url }) });
  } catch (error) {
    console.error("[auth] could not send verification email", error instanceof Error ? error.message : error);
  }
}

export async function sendMagicLink(email: string): Promise<{ devLink?: string }> {
  const user = await authRepo.findUserByEmail(email);
  if (!user) return {};
  const { token, minutes } = await authRepo.createAuthToken(user.id, "magic_link");
  const url = `${appUrl()}/magic?token=${encodeURIComponent(token)}`;
  const result = await sendMail({
    to: user.email,
    content: magicLinkEmail({ url, minutes }),
    revealLink: true,
  });
  return { devLink: result.devLink };
}

export async function consumeMagicLink(token: string): Promise<LoginResult> {
  const userId = await authRepo.consumeAuthToken(token, "magic_link");
  if (!userId) throw new ApiError(400, "invalid_token", "This link is invalid or has expired. Request a new one.");
  await authRepo.markEmailVerified(userId);
  const user = await authRepo.findUserById(userId);
  if (!user) throw new ApiError(400, "invalid_token", "This link is no longer valid.");
  const session = await authRepo.createSession({ userId });
  return { user, token: session.token, expiresAt: session.expiresAt };
}

export async function requestPasswordReset(email: string): Promise<{ devLink?: string }> {
  const user = await authRepo.findUserByEmail(email);
  if (!user) return {};
  const { token, minutes } = await authRepo.createAuthToken(user.id, "password_reset");
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const result = await sendMail({
    to: user.email,
    content: resetEmail({ url, minutes }),
    revealLink: true,
  });
  return { devLink: result.devLink };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<LoginResult> {
  const problem = passwordProblem(input.password);
  if (problem) throw new ApiError(422, "weak_password", problem);
  const userId = await authRepo.consumeAuthToken(input.token, "password_reset");
  if (!userId) throw new ApiError(400, "invalid_token", "This link is invalid or has expired. Request a new one.");
  await authRepo.setPassword(userId, await hashPassword(input.password));
  await authRepo.markEmailVerified(userId);
  const user = await authRepo.findUserById(userId);
  if (!user) throw new ApiError(400, "invalid_token", "This link is no longer valid.");
  const session = await authRepo.createSession({
    userId,
    userAgent: input.userAgent,
    ip: input.ip,
  });
  return { user, token: session.token, expiresAt: session.expiresAt };
}

export async function verifyEmailToken(token: string): Promise<AuthUser> {
  const userId = await authRepo.consumeAuthToken(token, "email_verify");
  if (!userId) throw new ApiError(400, "invalid_token", "This verification link is invalid or has expired.");
  await authRepo.markEmailVerified(userId);
  const user = await authRepo.findUserById(userId);
  if (!user) throw new ApiError(400, "invalid_token", "This account no longer exists.");
  return user;
}

export async function logout() {
  const token = await getSessionToken();
  if (token) await authRepo.deleteSession(token);
  await clearSessionCookie();
}

export function inviteUrl(token: string) {
  return `${appUrl()}/invite/${encodeURIComponent(token)}`;
}

export async function inviteMember(input: {
  orgId: string;
  orgName: string;
  inviterId: string;
  inviterName: string;
  email: string;
  role: "owner" | "admin" | "member";
}) {
  const { token } = await authRepo.createInvitation({
    orgId: input.orgId,
    email: input.email,
    role: input.role,
    invitedBy: input.inviterId,
  });
  const url = inviteUrl(token);
  const result = await sendMail({
    to: input.email,
    content: invitationEmail({
      inviter: input.inviterName,
      org: input.orgName,
      url,
      role: input.role,
    }),
    revealLink: true,
  });
  return { token, devLink: result.devLink };
}

export function sessionDto(user: AuthUser) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      timezone: user.timezone,
      emailVerified: Boolean(user.emailVerifiedAt),
    },
    org: user.orgId
      ? { id: user.orgId, name: user.orgName, slug: user.orgSlug, role: user.role }
      : null,
  };
}
