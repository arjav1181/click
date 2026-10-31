import { isCalendarProviderConfigured } from "@click/backend";
import { handler, json } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

/** Which calendar providers this instance can actually connect. */
export const GET = handler(async () => {
  await requireOrgSession();
  const providers = (["google", "microsoft"] as const).map((provider) => ({
    provider,
    configured: isCalendarProviderConfigured(provider),
    connectUrl: `/api/v1/calendars/providers/${provider}/start`,
  }));
  return json({ providers });
});
