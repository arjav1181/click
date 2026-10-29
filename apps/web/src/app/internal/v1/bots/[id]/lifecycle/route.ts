import { z } from "zod";
import { botsRepo } from "@click/db";
import { handler, json, ApiError } from "@/server/http";
import { readVerifiedBody } from "@/server/bot";

const schema = z.object({
  state: z.enum(["queued", "joining", "lobby", "active", "completed", "failed", "cancelled"]),
  detail: z.string().max(1000).nullable().optional(),
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { body } = await readVerifiedBody(request);
  const payload = schema.parse(body);

  const job = await botsRepo.findBotJob(id);
  if (!job) throw new ApiError(404, "not_found", "Bot job not found.");

  await botsRepo.updateBotJobState(job, {
    state: payload.state,
    detail: payload.detail ?? null,
    startedAt: payload.state === "active" ? new Date() : null,
    endedAt: ["completed", "failed", "cancelled"].includes(payload.state) ? new Date() : null,
  });
  return json({ ok: true, state: payload.state }, { status: 202 });
});
