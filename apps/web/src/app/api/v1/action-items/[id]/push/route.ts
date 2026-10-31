import { z } from "zod";
import { integrationsRepo, workspaceRepo } from "@click/db";
import { decryptSecret, pushTask, TASK_PROVIDERS, type TaskProvider } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  provider: z.enum(TASK_PROVIDERS as [TaskProvider, ...TaskProvider[]]),
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, schema);
  const ctx = { orgId: session.orgId, userId: session.id };

  const item = await workspaceRepo.getActionItem(ctx, id);
  if (!item) throw new ApiError(404, "not_found", "That task does not exist.");

  const connection = await integrationsRepo.getIntegrationConnection(ctx, body.provider);
  if (!connection) {
    throw new ApiError(
      409,
      "provider_not_connected",
      `Connect ${body.provider} on the Integrations page before pushing tasks to it.`,
    );
  }
  if (connection.status !== "connected") {
    throw new ApiError(409, "provider_not_connected", `The ${body.provider} connection is ${connection.status}.`);
  }
  if (!connection.credentialsEnc) {
    throw new ApiError(
      409,
      "provider_not_configured",
      `The ${body.provider} connection has no API token saved. Add one on the Integrations page.`,
    );
  }

  let credentials: Record<string, string>;
  try {
    const decoded = JSON.parse(decryptSecret(connection.credentialsEnc)) as unknown;
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
      throw new Error("not an object");
    }
    credentials = Object.fromEntries(
      Object.entries(decoded as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]),
    );
  } catch {
    throw new ApiError(
      500,
      "credentials_unreadable",
      "The saved API token for this integration could not be read. Reconnect it with a new token.",
    );
  }

  let result;
  try {
    result = await pushTask(
      body.provider,
      credentials,
      connection.config,
      {
        text: item.text,
        assigneeName: item.assigneeName,
        dueAt: item.dueAt ? new Date(item.dueAt) : null,
        meetingTitle: item.meetingTitle,
      },
    );
  } catch (error) {
    throw new ApiError(
      502,
      "push_failed",
      error instanceof Error ? error.message : "The task could not be pushed.",
    );
  }

  const ref = {
    provider: result.provider,
    externalId: result.externalId,
    url: result.url,
    label: result.label,
    pushedAt: new Date().toISOString(),
  };
  await workspaceRepo.recordActionItemPush(ctx, id, ref);

  await recordAudit(session, {
    action: "action_item.pushed",
    targetType: "action_item",
    targetId: id,
    metadata: { provider: result.provider, externalId: result.externalId },
    ip: clientIp(request),
  });

  return json({ ok: true, ref });
});
