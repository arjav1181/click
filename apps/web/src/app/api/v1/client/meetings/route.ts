import { meetingsRepo } from "@click/db";
import { clientHandler, requireClientAuth } from "@/server/clientAuth";

/**
 * Meetings a client app can attach a recording to. The client sends its API
 * key; the key's workspace decides what it sees, so a client can never read
 * another workspace's meetings.
 */
export const GET = clientHandler(async (request) => {
  const auth = await requireClientAuth(request, "meetings:read");
  const url = new URL(request.url);
  const result = await meetingsRepo.listMeetings(
    { orgId: auth.orgId, userId: auth.userId },
    {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100),
    },
  );
  return Response.json(result);
});
