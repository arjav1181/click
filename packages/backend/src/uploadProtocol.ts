/**
 * The chunk protocol shared by the client apps and the upload route.
 *
 * It is pure arithmetic, so it is tested directly rather than through a
 * browser: a client that disagrees about the chunk size or the last chunk
 * number would corrupt every recording.
 */

/** Chunks are 8 MiB: large enough to keep the request count low, small
 * enough that a retry does not move much data. */
export const CHUNK_SIZE = 8 * 1024 * 1024;

/** The last chunk index a recording of `totalBytes` can have. */
export function lastChunkIndex(totalBytes: number, chunkSize = CHUNK_SIZE): number {
  return Math.ceil(totalBytes / chunkSize) - 1;
}

/**
 * Whether a chunk index belongs to a recording of `totalBytes`. A recording
 * of an unknown size (the streaming case) accepts any index.
 */
export function isChunkInRange(
  index: number,
  totalBytes: number | null,
  chunkSize = CHUNK_SIZE,
): boolean {
  if (!Number.isInteger(index) || index < 0) return false;
  if (totalBytes === null) return true;
  return index <= lastChunkIndex(totalBytes, chunkSize);
}
