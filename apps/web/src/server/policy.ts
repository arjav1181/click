import { workspaceRepo } from "@click/db";
import { assertBudget } from "@click/backend";
import { ApiError } from "./http";

/**
 * Reads the workspace AI policy. Admin screens use it to render the gates and
 * the budget cap; feature routes use it to refuse work the operator turned
 * off.
 */
export async function loadAiPolicy(orgId: string, userId: string) {
  return workspaceRepo.getAiPolicy({ orgId, userId });
}

export async function requireFeature(
  orgId: string,
  userId: string,
  gate: "summaries" | "actionItems" | "semanticSearch" | "transcription",
) {
  const policy = await loadAiPolicy(orgId, userId);
  if (policy.featureGates[gate]) return policy;
  const labels: Record<string, { subject: string; verb: string }> = {
    summaries: { subject: "AI summaries", verb: "are" },
    actionItems: { subject: "AI action items", verb: "are" },
    semanticSearch: { subject: "Semantic search", verb: "is" },
    transcription: { subject: "Transcription", verb: "is" },
  };
  const { subject, verb } = labels[gate];
  throw new ApiError(
    403,
    "feature_disabled",
    `${subject} ${verb} turned off for this workspace. An admin can enable it under Admin → AI.`,
  );
}

/**
 * Refuses new AI work once the workspace has used its monthly cap. The job
 * worker checks again, but failing here gives the user an answer right away.
 */
export async function requireBudget(orgId: string) {
  await assertBudget(orgId);
}
