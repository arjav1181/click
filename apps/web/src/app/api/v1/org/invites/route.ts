import { z } from "zod";
import { assertSameOrigin, handler, json, limit, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole, inviteMember } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Use a valid email address.").max(320),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  await limit(request, "invite", 20, 60 * 60_000);
  const body = await parseJson(request, schema);
  if (body.role === "owner" && session.role !== "owner") {
    throw new ApiError(403, "forbidden", "Only an owner can invite another owner.");
  }
  const result = await inviteMember({
    orgId: session.orgId,
    orgName: session.orgName,
    inviterId: session.id,
    inviterName: session.name,
    email: body.email,
    role: body.role,
  });
  await recordAudit(session, {
    action: "member.invited",
    targetType: "invitation",
    targetId: body.email,
    metadata: { role: body.role },
    ip: clientIp(request),
  });
  return json({ ok: true, ...(result.devLink ? { devLink: result.devLink } : {}) }, { status: 201 });
});
