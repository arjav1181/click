import { z } from "zod";
import { integrationsRepo } from "@click/db";
import { encryptSecret } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const connectSchema = z.object({
  integrationKey: z.string().trim().min(1).max(80),
  config: z.record(z.string(), z.unknown()).optional(),
  // Personal API tokens the workspace brought along. They are encrypted
  // before they reach the database and never sent back to the browser.
  credentials: z.record(z.string(), z.string()).optional(),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const data = await integrationsRepo.listIntegrations({ orgId: session.orgId, userId: session.id });
  return json(data);
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, connectSchema);

  const created = await integrationsRepo.connectIntegration(
    { orgId: session.orgId, userId: session.id },
    {
      integrationKey: body.integrationKey,
      config: body.config,
      credentialsEnc: body.credentials ? encryptSecret(JSON.stringify(body.credentials)) : undefined,
    },
  );

  await recordAudit(session, {
    action: "integration.connected",
    targetType: "integration",
    targetId: body.integrationKey,
    metadata: { connectionId: created.id },
    ip: clientIp(request),
  });

  return json(created, { status: 201 });
});
