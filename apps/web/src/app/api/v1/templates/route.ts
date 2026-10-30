import { z } from "zod";
import { notesRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const sectionSchema = z.object({
  key: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(120),
});

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the template a name.").max(120),
  description: z.string().trim().max(500).optional(),
  prompt: z.string().trim().max(8000).optional(),
  sections: z.array(sectionSchema).max(30).optional(),
  scope: z.enum(["personal", "workspace"]).default("personal"),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const templates = await notesRepo.listTemplates({
    orgId: session.orgId,
    userId: session.id,
  });
  return json({ templates });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, createSchema);

  // Sharing a template with the whole workspace is an admin move.
  if (body.scope === "workspace") {
    requireRole(session, ["owner", "admin"]);
  }

  const template = await notesRepo.createTemplate(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "template.created",
    targetType: "template",
    targetId: template.id,
    metadata: { scope: template.scope },
    ip: clientIp(request),
  });
  return json({ template }, { status: 201 });
});
