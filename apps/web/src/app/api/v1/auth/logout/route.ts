import { assertSameOrigin, handler, noContent } from "@/server/http";
import { logout } from "@/server/auth";

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await logout();
  return noContent();
});
