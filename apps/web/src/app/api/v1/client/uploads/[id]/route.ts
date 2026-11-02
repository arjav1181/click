import { uploadsRepo } from "@click/db";
import { clientHandler, requireClientAuth } from "@/server/clientAuth";
import { ApiError } from "@/server/http";

/**
 * Reports which chunks the server already has, so a client that lost its
 * connection resumes instead of starting over.
 */
export const GET = clientHandler(
  async (request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const auth = await requireClientAuth(request, "recordings:write");
    const ctx = { orgId: auth.orgId, userId: auth.userId };
    const session = await uploadsRepo.getUploadSession(ctx, id);
    if (!session) throw new ApiError(404, "not_found", "Upload not found.");
    const chunks = await uploadsRepo.listUploadChunks(ctx, session.id);
    return Response.json({
      uploadId: session.id,
      meetingId: session.meetingId,
      chunkSize: session.chunkSize,
      receivedChunks: chunks.map((chunk) => chunk.chunkIndex),
      receivedBytes: session.receivedBytes,
      state: session.state,
    });
  },
);
