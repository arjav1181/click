import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { encryptSecret } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  kind: z.enum(["asr", "llm", "embedding"]),
  provider: z.string().trim().min(1).max(60),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  apiKey: z.string().trim().max(500).optional(),
  model: z.string().trim().max(120).nullable().optional(),
  enabled: z.boolean().optional(),
});

/**
 * Registers a bring-your-own-key provider for the workspace. The key is
 * encrypted before it reaches the database and is never returned by the API.
 */
export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, schema);
  const ctx = { orgId: session.orgId, userId: session.id };

  const enabled = body.enabled ?? true;
  if (enabled && body.provider !== "mock" && !body.apiKey) {
    throw new ApiError(422, "missing_key", "Add an API key for this provider, or switch it off.");
  }
  const status = body.provider === "mock" ? "ok" : body.apiKey ? "ok" : "unconfigured";

  const row = await workspaceRepo.upsertProviderConfig(ctx, {
    kind: body.kind,
    provider: body.provider,
    baseUrl: body.baseUrl ?? null,
    apiKeyEnc: body.apiKey ? encryptSecret(body.apiKey) : null,
    model: body.model ?? null,
    status,
    isDefault: true,
    options: { enabled },
  });

  await recordAudit(session, {
    action: "ai.provider.saved",
    targetType: "provider_config",
    targetId: row?.id ?? body.kind,
    metadata: { kind: body.kind, provider: body.provider, enabled },
    ip: clientIp(request),
  });

  const providers = await workspaceRepo.listProviderConfigs(ctx);
  return json({ providers, saved: row?.id ?? null });
});
