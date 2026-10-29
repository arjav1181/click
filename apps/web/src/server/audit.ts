import { workspaceRepo } from "@click/db";
import type { OrgSession } from "./auth";

/**
 * Audit rows are written in the same request as the mutation. Failures are
 * logged, never surfaced: losing an audit row must not fail a user's action.
 */
export async function recordAudit(
  session: Pick<OrgSession, "orgId" | "id">,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  },
) {
  try {
    await workspaceRepo.writeAudit({
      orgId: session.orgId,
      actorId: session.id,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ip: input.ip,
    });
  } catch (error) {
    console.error("[audit] write failed", error instanceof Error ? error.message : error);
  }
}
