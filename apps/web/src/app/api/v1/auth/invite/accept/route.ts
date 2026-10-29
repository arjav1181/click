import { z } from "zod";
import { authRepo, hashPassword, verifyPassword } from "@click/db";
import { assertSameOrigin, handler, json, limit, parseJson, clientIp, ApiError } from "@/server/http";
import { getSession, sessionDto, setSessionCookie } from "@/server/auth";

const schema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(10, "Use at least 10 characters.").max(512).optional(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await limit(request, "invite-accept", 10, 15 * 60_000);
  const body = await parseJson(request, schema);

  const invitation = await authRepo.previewInvitation(body.token);
  if (!invitation) {
    throw new ApiError(400, "invalid_invite", "This invitation is invalid, used or expired.");
  }

  const existing = await authRepo.findUserByEmail(invitation.email);
  let userId: string;
  if (existing) {
    const current = await getSession();
    if (current?.id !== existing.id) {
      if (!body.password) {
        throw new ApiError(401, "password_required", "Sign in with your existing account to accept this invitation.");
      }
      if (!(await verifyPassword(body.password, existing.passwordHash))) {
        throw new ApiError(401, "invalid_credentials", "That password is incorrect.");
      }
    }
    userId = existing.id;
  } else {
    if (!body.password) {
      throw new ApiError(422, "password_required", "Choose a password to join this workspace.");
    }
    const created = await authRepo.createUserAccount({
      email: invitation.email,
      name: body.name ?? invitation.email.split("@")[0],
      passwordHash: await hashPassword(body.password),
      emailVerifiedAt: new Date(),
    });
    userId = created.id;
  }

  const accepted = await authRepo.acceptInvitation(body.token, userId);
  if (!accepted) throw new ApiError(400, "invalid_invite", "This invitation could not be accepted.");

  const session = await authRepo.createSession({
    userId,
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });
  await setSessionCookie(session.token, session.expiresAt);
  const full = await authRepo.findUserById(userId);
  if (!full) throw new ApiError(500, "account_missing", "The account could not be loaded.");
  return json(sessionDto(full));
});
