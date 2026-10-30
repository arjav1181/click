import { meetingsRepo } from "@click/db";
import { extractFrame, getObject } from "@click/backend";
import { handler, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const ctx = { orgId: session.orgId, userId: session.id };

  const url = new URL(request.url);
  const ms = Number(url.searchParams.get("ms") ?? "0");
  if (!Number.isFinite(ms) || ms < 0) {
    throw new ApiError(422, "invalid_timestamp", "Provide a timestamp in milliseconds.");
  }

  const recording = await meetingsRepo.getMeetingRecording(ctx, id);
  if (!recording) {
    throw new ApiError(409, "no_video", "This meeting has no stored recording.");
  }

  const base64 = await extractFrame(recording.storageKey, ms);
  if (!base64) {
    throw new ApiError(409, "frame_unavailable", "Could not extract a frame at that timestamp.");
  }

  const buffer = Buffer.from(base64, "base64");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
});
