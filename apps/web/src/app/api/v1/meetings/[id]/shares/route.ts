import { z } from "zod";
import { sharingRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  access: z.enum(["link", "domain", "password"]).default("link"),
  password: z.string().min(4).max(200).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const shares = await sharingRepo.listShares({ orgId: session.orgId, userId: session.id }, id);
  return json({ shares });
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, createSchema);

  if (body.access === "password" && !body.password) {
    throw new ApiError(422, "password_required", "Set a password for password-protected shares.");
  }

  const created = await sharingRepo.createShare(
    { orgId: session.orgId, userId: session.id },
    {
      meetingId: id,
      access: body.access,
      password: body.password ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  );

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/r/${created.token}`;

  await recordAudit(session, {
    action: "share.created",
    targetType: "meeting",
    targetId: id,
    metadata: { access: body.access, shareId: created.id },
    ip: clientIp(request),
  });

  return json({ share: { id: created.id }, link, token: created.token }, { status: 201 });
});
