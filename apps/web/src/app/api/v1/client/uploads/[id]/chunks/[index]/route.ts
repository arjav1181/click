import { uploadsRepo } from "@click/db";
import { isChunkInRange, uploadPart } from "@click/backend";
import { clientHandler, requireClientAuth } from "@/server/clientAuth";
import { ApiError } from "@/server/http";

/**
 * Stores one chunk of a recording. The chunk number is part of the URL, so a
 * client that loses the connection can ask which chunks arrived and send
 * only the missing ones.
 */
export const PUT = clientHandler(
  async (request, context: { params: Promise<{ id: string; index: string }> }) => {
    const { id, index } = await context.params;
    const auth = await requireClientAuth(request, "recordings:write");
    const chunkIndex = Number(index);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new ApiError(400, "invalid_chunk", "That chunk number is not valid.");
    }

    const ctx = { orgId: auth.orgId, userId: auth.userId };
    const session = await uploadsRepo.getUploadSession(ctx, id);
    if (!session) throw new ApiError(404, "not_found", "Upload not found.");
    if (session.state !== "open") {
      throw new ApiError(409, "upload_closed", "This upload has already finished.");
    }

    const body = Buffer.from(await request.arrayBuffer());
    if (body.length === 0) throw new ApiError(422, "empty_chunk", "That chunk is empty.");
    if (body.length > session.chunkSize) {
      throw new ApiError(413, "chunk_too_large", "That chunk is larger than the agreed chunk size.");
    }
    // The client declared the recording size up front, so a chunk beyond it
    // is a client bug rather than a resumable retry.
    if (!isChunkInRange(chunkIndex, session.totalBytes, session.chunkSize)) {
      throw new ApiError(422, "invalid_chunk", "That chunk is past the end of the recording.");
    }

    const { etag } = await uploadPart(
      session.storageKey,
      session.storageUploadId ?? "local",
      chunkIndex + 1,
      body,
    );
    const receivedBytes = await uploadsRepo.recordUploadChunk(ctx, {
      uploadId: session.id,
      chunkIndex,
      sizeBytes: body.length,
      etag: etag ?? null,
    });

    return Response.json({ ok: true, chunkIndex, receivedBytes });
  },
);
