import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

/**
 * Workspace AI policy: budget cap, feature gates, model defaults and the
 * bring-your-own-key provider rows. Everything here is per workspace so a
 * self-hosted operator can tune one instance without touching the process
 * environment.
 */
export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const ctx = { orgId: session.orgId, userId: session.id };
  const [policy, providers, usage] = await Promise.all([
    workspaceRepo.getAiPolicy(ctx),
    workspaceRepo.listProviderConfigs(ctx),
    workspaceRepo.getUsage(ctx),
  ]);
  return json({ policy, providers, usage });
});

const patchSchema = z.object({
  budgetCap: z.number().min(0).max(100_000).optional(),
  featureGates: z
    .object({
      summaries: z.boolean().optional(),
      actionItems: z.boolean().optional(),
      semanticSearch: z.boolean().optional(),
      transcription: z.boolean().optional(),
    })
    .optional(),
  modelDefaults: z
    .object({
      asr: z.string().trim().max(120).nullable().optional(),
      llm: z.string().trim().max(120).nullable().optional(),
      embeddings: z.string().trim().max(120).nullable().optional(),
    })
    .optional(),
});

export const PATCH = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, patchSchema);
  const ctx = { orgId: session.orgId, userId: session.id };
  const policy = await workspaceRepo.updateAiPolicy(ctx, body);
  if (body.budgetCap !== undefined) {
    await workspaceRepo.setUsageBudgetCap(ctx, body.budgetCap);
  }
  await recordAudit(session, {
    action: "ai.policy.updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ policy });
});
