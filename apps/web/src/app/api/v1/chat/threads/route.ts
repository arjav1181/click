import { z } from "zod";
import { chatRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  title: z.string().trim().max(200).optional(),
  scope: z.enum(["global", "folder", "channel", "meeting", "person", "company", "selection"]).default("global"),
  scopeIds: z.array(z.string().uuid()).max(20).optional(),
  mode: z.enum(["chat", "work"]).default("chat"),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const threads = await chatRepo.listThreads({ orgId: session.orgId, userId: session.id });
  return json({ threads });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, createSchema);
  const thread = await chatRepo.createThread(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  return json({ thread }, { status: 201 });
});
