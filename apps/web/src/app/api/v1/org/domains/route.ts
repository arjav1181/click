import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

const schema = z.object({
  domain: z.string().trim().toLowerCase().max(200),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, schema);

  const domain = body.domain.replace(/^@/, "").trim();
  if (!DOMAIN_RE.test(domain)) {
    throw new ApiError(422, "invalid_domain", "Enter a domain such as example.com.");
  }
  if (domain.endsWith(".click.local") || domain === "click.local") {
    throw new ApiError(422, "reserved_domain", "That domain is reserved.");
  }

  const result = await workspaceRepo.addDomainAllowlist(
    { orgId: session.orgId, userId: session.id },
    domain,
  );
  if (!result.ok) {
    if (result.reason === "conflict") {
      throw new ApiError(
        409,
        "domain_conflict",
        `${domain} is already used by ${result.conflictWith}. Ask an admin there to release it.`,
      );
    }
    throw new ApiError(409, "too_many_domains", "A workspace can auto-join at most 50 domains.");
  }
  if (!result.alreadyPresent) {
    await recordAudit(session, {
      action: "org.domain_added",
      targetType: "organization",
      targetId: session.orgId,
      metadata: { domain },
      ip: clientIp(request),
    });
  }

  const org = await workspaceRepo.getOrganization({ orgId: session.orgId, userId: session.id });
  return json({ domainAllowlist: org?.domainAllowlist ?? [] });
});

export const DELETE = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const url = new URL(request.url);
  const domain = (url.searchParams.get("domain") ?? "").trim().toLowerCase();
  if (!domain) throw new ApiError(422, "invalid_domain", "Send the domain to remove.");

  await workspaceRepo.removeDomainAllowlist(
    { orgId: session.orgId, userId: session.id },
    domain,
  );
  await recordAudit(session, {
    action: "org.domain_removed",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { domain },
    ip: clientIp(request),
  });
  const org = await workspaceRepo.getOrganization({ orgId: session.orgId, userId: session.id });
  return json({ domainAllowlist: org?.domainAllowlist ?? [] });
});
