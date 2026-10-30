import { z } from "zod";
import { speakersRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const speakers = await speakersRepo.listSpeakers({ orgId: session.orgId, userId: session.id });
  return json({ speakers });
});
