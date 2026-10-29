import { handler, json, limit } from "@/server/http";
import { authRepo } from "@click/db";
import { ApiError } from "@/server/http";

export const GET = handler(async (request, context: { params: Promise<{ token: string }> }) => {
  await limit(request, "invite-preview", 30, 15 * 60_000);
  const { token } = await context.params;
  const invitation = await authRepo.previewInvitation(token);
  if (!invitation) {
    throw new ApiError(404, "invalid_invite", "This invitation is invalid, used or expired.");
  }
  return json({
    invitation: {
      email: invitation.email,
      role: invitation.role,
      orgName: invitation.orgName,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  });
});
