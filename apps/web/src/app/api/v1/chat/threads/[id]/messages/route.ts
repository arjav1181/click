import { z } from "zod";
import { chatRepo, meetingsRepo } from "@click/db";
import { chat, chatWithVision, resolveProviderOverride, extractFrame } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  content: z.string().trim().min(1, "Ask something.").max(4000),
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const thread = await chatRepo.getThread({ orgId: session.orgId, userId: session.id }, id);
  if (!thread) throw new ApiError(404, "not_found", "That thread does not exist.");

  await chatRepo.appendMessage(
    { orgId: session.orgId, userId: session.id },
    { threadId: id, role: "user", content: body.content },
  );

  const snippets = await chatRepo.gatherSnippets(
    { orgId: session.orgId, userId: session.id },
    thread.scope,
    thread.scopeIds,
  );

  const override = await resolveProviderOverride(session.orgId, "llm");

  // Resolve a recording we can pull frames from, if any.
  const meetingIds = Array.from(new Set(snippets.map((snippet) => snippet.meetingId)));
  const storageKeys: string[] = [];
  for (const meetingId of meetingIds) {
    const recording = await meetingsRepo.getMeetingRecording({ orgId: session.orgId, userId: session.id }, meetingId);
    if (recording) storageKeys.push(recording.storageKey);
  }

  const result =
    storageKeys.length > 0
      ? await chatWithVision({
          question: body.content,
          snippets,
          override,
          extractFrame: async (timestampMs) => {
            for (const key of storageKeys) {
              const frame = await extractFrame(key, timestampMs);
              if (frame) return frame;
            }
            return null;
          },
        })
      : await chat({
          question: body.content,
          snippets,
          override,
        });

  const assistant = await chatRepo.appendMessage(
    { orgId: session.orgId, userId: session.id },
    {
      threadId: id,
      role: "assistant",
      content: result.answer,
      model: result.model,
      tokensIn: result.usage.inputTokens,
      tokensOut: result.usage.outputTokens,
      citations: result.citations,
    },
  );

  // Title the thread from the first question if it has none.
  if (!thread.title) {
    await chatRepo.updateThread({ orgId: session.orgId, userId: session.id }, id, {
      title: body.content.slice(0, 80),
    });
  }

  await recordAudit(session, {
    action: "chat.asked",
    targetType: "chat_thread",
    targetId: id,
    metadata: { tokensIn: result.usage.inputTokens, tokensOut: result.usage.outputTokens },
    ip: clientIp(request),
  });

  const frames = "frames" in result ? (result as { frames: Array<{ timestampMs: number; base64: string }> }).frames : [];
  return json({ message: assistant, citations: result.citations, frames });
});
