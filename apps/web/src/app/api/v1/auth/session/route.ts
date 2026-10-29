import { handler, json } from "@/server/http";
import { getSession, sessionDto } from "@/server/auth";

export const GET = handler(async () => {
  const user = await getSession();
  if (!user) return json({ user: null, org: null });
  return json(sessionDto(user));
});
