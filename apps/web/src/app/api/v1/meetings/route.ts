import { z } from "zod";
import { meetingsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  const url = new URL(request.url);
  const result = await meetingsRepo.listMeetings(
    { orgId: session.orgId, userId: session.id },
    {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      folderId: url.searchParams.get("folderId") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
    },
  );
  return json(result);
});

const schema = z.object({
  title: z.string().trim().min(1).max(300),
  source: z.enum(["bot", "desktop", "extension", "mobile", "web", "upload", "api"]).default("web"),
  startedAt: z.string().datetime().optional(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, schema);
  const meeting = await meetingsRepo.createMeeting(
    { orgId: session.orgId, userId: session.id },
    {
      title: body.title,
      source: body.source,
      startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
    },
  );
  await recordAudit(session, {
    action: "meeting.created",
    targetType: "meeting",
    targetId: meeting.id,
    metadata: { source: body.source },
    ip: clientIp(request),
  });
  return json({ meeting }, { status: 201 });
});
