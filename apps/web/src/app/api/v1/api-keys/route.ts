import { z } from "zod";
import { developersRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the key a name.").max(120),
  scopes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const keys = await developersRepo.listApiKeys({ orgId: session.orgId, userId: session.id });
  return json({ keys, scopes: developersRepo.availableScopes() });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, createSchema);

  const invalid = body.scopes.filter((scope) => !developersRepo.availableScopes().includes(scope));
  if (invalid.length) {
    throw new ApiError(422, "invalid_scope", `Unknown scopes: ${invalid.join(", ")}.`);
  }

  const created = await developersRepo.createApiKey(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "api_key.created",
    targetType: "api_key",
    targetId: created.id,
    metadata: { name: body.name, scopes: body.scopes },
    ip: clientIp(request),
  });
  return json(created, { status: 201 });
});
