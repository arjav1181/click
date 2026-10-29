import { Readable } from "node:stream";
import { getObject } from "@click/backend";
import { handler, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async (request, context: { params: Promise<{ key: string[] }> }) => {
  const session = await requireOrgSession();
  const { key } = await context.params;
  const storageKey = key.join("/");

  // Keys are namespaced by org; RLS is not enough for object storage.
  if (!storageKey.startsWith(`orgs/${session.orgId}/`) || storageKey.includes("..")) {
    throw new ApiError(404, "not_found", "File not found.");
  }
  const object = await getObject(storageKey);
  if (!object) throw new ApiError(404, "not_found", "File not found.");

  return new Response(Readable.toWeb(object.body as Readable) as ReadableStream, {
    headers: {
      "Content-Type": object.contentType,
      ...(object.size ? { "Content-Length": String(object.size) } : {}),
      "Content-Disposition": `inline; filename="${storageKey.split("/").pop() ?? "recording"}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
