import { z } from "zod";
import { soundbitesRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  meetingId: z.string().uuid(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  title: z.string().trim().max(200).optional(),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const soundbites = await soundbitesRepo.listSoundbites({ orgId: session.orgId, userId: session.id });
  return json({ soundbites });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, createSchema);
  if (body.endMs <= body.startMs) {
    throw new ApiError(422, "invalid_range", "End time must be after start time.");
  }
  const created = await soundbitesRepo.createSoundbite(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "soundbite.created",
    targetType: "soundbite",
    targetId: created.id,
    metadata: { meetingId: body.meetingId },
    ip: clientIp(request),
  });
  return json(created, { status: 201 });
});
