import { and, asc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import {
  actionItems,
  auditEvents,
  channelMembers,
  channels,
  folders,
  memberships,
  meetings,
  organizations,
  providerConfigs,
  spaces,
  users,
  usageMeters,
} from "../schema";

export async function listActionItems(ctx: TenantContext, status?: string) {
  return withTenant(ctx, async (tx) => {
    const conditions = [];
    if (status) conditions.push(eq(actionItems.status, status as never));
    const rows = await tx
      .select({
        id: actionItems.id,
        meetingId: actionItems.meetingId,
        meetingTitle: meetings.title,
        text: actionItems.text,
        assigneeName: actionItems.assigneeName,
        dueAt: actionItems.dueAt,
        status: actionItems.status,
        sourceSegmentId: actionItems.sourceSegmentId,
      })
      .from(actionItems)
      .innerJoin(meetings, eq(meetings.id, actionItems.meetingId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(actionItems.dueAt));
    return rows.map((r) => ({ ...r, dueAt: r.dueAt?.toISOString() ?? null }));
  });
}

export async function toggleActionItem(ctx: TenantContext, id: string, done: boolean) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .update(actionItems)
      .set({ status: done ? "done" : "open", completedAt: done ? new Date() : null })
      .where(eq(actionItems.id, id))
      .returning({ id: actionItems.id });
    return rows.length > 0;
  });
}

export async function createActionItem(
  ctx: TenantContext,
  input: { meetingId: string; text: string; assigneeName?: string; dueAt?: Date },
) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(actionItems)
      .values({
        orgId: ctx.orgId,
        meetingId: input.meetingId,
        text: input.text.slice(0, 2000),
        assigneeName: input.assigneeName ?? null,
        dueAt: input.dueAt ?? null,
      })
      .returning({ id: actionItems.id });
    return rows[0];
  });
}

export async function getUsage(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(usageMeters)
      .orderBy(sql`period_start desc`)
      .limit(1);
    const row = rows[0];
    return {
      periodStart: row?.periodStart?.toISOString() ?? null,
      periodEnd: row?.periodEnd?.toISOString() ?? null,
      asrSeconds: row?.asrSeconds ?? 0,
      llmTokensIn: row?.llmTokensIn ?? 0,
      llmTokensOut: row?.llmTokensOut ?? 0,
      costEstimate: Number(row?.costEstimate ?? 0),
      budgetCap: Number(row?.budgetCap ?? 0),
      currency: "USD",
    };
  });
}

export async function listFolders(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: folders.id,
        name: folders.name,
        parentId: folders.parentId,
        spaceId: folders.spaceId,
        icon: folders.icon,
        description: folders.description,
        linkAccess: folders.linkAccess,
        ownerId: folders.ownerId,
        meetingCount: sql<number>`(select count(*)::int from meeting_folders mf where mf.folder_id = ${sql.raw('"folders"."id"')})`,
      })
      .from(folders)
      .orderBy(asc(folders.name));
    return rows;
  });
}

export async function listSpaces(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: spaces.id,
        name: spaces.name,
        icon: spaces.icon,
        description: spaces.description,
        kind: spaces.kind,
        folderCount: sql<number>`(select count(*)::int from folders f where f.space_id = ${sql.raw('"spaces"."id"')})`,
      })
      .from(spaces)
      .orderBy(asc(spaces.name));
    return rows;
  });
}

export async function createSpace(
  ctx: TenantContext,
  input: { name: string; kind: "personal" | "team" | "custom"; description?: string | null },
) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(spaces)
      .values({
        orgId: ctx.orgId,
        name: input.name.slice(0, 120),
        kind: input.kind,
        icon: "space",
        description: input.description ?? null,
      })
      .returning({ id: spaces.id, name: spaces.name, kind: spaces.kind });
    return rows[0];
  });
}

export async function listChannels(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    return tx
      .select({
        id: channels.id,
        name: channels.name,
        visibility: channels.visibility,
        description: channels.description,
        archivedAt: channels.archivedAt,
        memberCount: sql<number>`(select count(*)::int from channel_members cm where cm.channel_id = ${sql.raw('"channels"."id"')})`,
        meetingCount: sql<number>`(select count(*)::int from meeting_channels mc where mc.channel_id = ${sql.raw('"channels"."id"')})`,
      })
      .from(channels)
      .orderBy(asc(channels.name));
  });
}

export async function getChannel(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: channels.id,
        name: channels.name,
        visibility: channels.visibility,
        description: channels.description,
        archivedAt: channels.archivedAt,
        memberCount: sql<number>`(select count(*)::int from channel_members cm where cm.channel_id = ${sql.raw('"channels"."id"')})`,
        meetingCount: sql<number>`(select count(*)::int from meeting_channels mc where mc.channel_id = ${sql.raw('"channels"."id"')})`,
      })
      .from(channels)
      .where(eq(channels.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listChannelMembers(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (tx) => {
    return tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
      })
      .from(channelMembers)
      .innerJoin(users, eq(users.id, channelMembers.userId))
      .leftJoin(
        memberships,
        and(eq(memberships.userId, users.id), eq(memberships.orgId, ctx.orgId)),
      )
      .where(eq(channelMembers.channelId, id))
      .orderBy(asc(users.name));
  });
}

export async function updateChannel(
  ctx: TenantContext,
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    visibility?: "public" | "private";
    archived?: boolean;
  },
) {
  return withTenant(ctx, async (tx) => {
    const values: Record<string, unknown> = {};
    if (patch.name !== undefined) values.name = patch.name.slice(0, 120);
    if (patch.description !== undefined) values.description = patch.description;
    if (patch.visibility !== undefined) values.visibility = patch.visibility;
    if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;
    if (Object.keys(values).length === 0) return false;
    const rows = await tx
      .update(channels)
      .set(values)
      .where(eq(channels.id, id))
      .returning({ id: channels.id });
    return rows.length > 0;
  });
}

export async function listMembers(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    return tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        status: memberships.status,
        lastSeenAt: users.lastSeenAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .orderBy(asc(users.name));
  });
}

export interface AuditEventFilters {
  action?: string;
  actorId?: string;
  targetType?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export async function listAuditEvents(ctx: TenantContext, filters: AuditEventFilters = {}) {
  return withTenant(ctx, async (tx) => {
    const conditions = [];
    if (filters.action) conditions.push(eq(auditEvents.action, filters.action));
    if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId));
    if (filters.targetType) conditions.push(eq(auditEvents.targetType, filters.targetType));
    if (filters.since) conditions.push(sql`${auditEvents.createdAt} >= ${filters.since}`);
    if (filters.until) conditions.push(sql`${auditEvents.createdAt} <= ${filters.until}`);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);
    const rows = await tx
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        targetType: auditEvents.targetType,
        targetId: auditEvents.targetId,
        metadata: auditEvents.metadata,
        createdAt: auditEvents.createdAt,
        ip: auditEvents.ip,
        actorId: auditEvents.actorId,
        actorName: users.name,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${auditEvents.createdAt} desc`)
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  });
}

/** Distinct action names seen in the workspace, for the audit filter dropdown. */
export async function listAuditActions(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .selectDistinct({ action: auditEvents.action })
      .from(auditEvents)
      .orderBy(asc(auditEvents.action));
    return rows.map((row) => row.action);
  });
}

export async function writeAudit(input: {
  orgId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  return withTenant({ orgId: input.orgId, userId: input.actorId }, async (tx) => {
    await tx.insert(auditEvents).values({
      orgId: input.orgId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
    });
  });
}

export async function getOrganization(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logoUrl: organizations.logoUrl,
        domainAllowlist: organizations.domainAllowlist,
        settings: organizations.settings,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function updateOrganization(
  ctx: TenantContext,
  patch: { name?: string; logoUrl?: string | null; domainAllowlist?: string[] },
) {
  return withTenant(ctx, async (tx) => {
    const values: Record<string, unknown> = {};
    if (patch.name !== undefined) values.name = patch.name.slice(0, 120);
    if (patch.logoUrl !== undefined) values.logoUrl = patch.logoUrl;
    if (patch.domainAllowlist !== undefined) values.domainAllowlist = patch.domainAllowlist.slice(0, 50);
    if (Object.keys(values).length > 0) {
      await tx.update(organizations).set(values).where(eq(organizations.id, ctx.orgId));
    }
    return true;
  });
}

/**
 * Workspace AI policy. It lives in the organization settings blob so a
 * self-hosted install has one place to look for gates, defaults and the cap.
 */
export interface AiPolicy {
  budgetCap: number;
  featureGates: {
    summaries: boolean;
    actionItems: boolean;
    semanticSearch: boolean;
    transcription: boolean;
  };
  modelDefaults: {
    asr: string | null;
    llm: string | null;
    embeddings: string | null;
  };
}

export const defaultAiPolicy: AiPolicy = {
  budgetCap: 0,
  featureGates: {
    summaries: true,
    actionItems: true,
    semanticSearch: false,
    transcription: true,
  },
  modelDefaults: {
    asr: null,
    llm: null,
    embeddings: null,
  },
};

function readPolicy(settings: unknown): AiPolicy {
  const raw = (settings ?? {}) as Record<string, unknown>;
  const gates = (raw.feature_gates ?? {}) as Record<string, unknown>;
  const defaults = (raw.model_defaults ?? {}) as Record<string, unknown>;
  return {
    budgetCap: Number(raw.ai_budget_cap ?? 0) || 0,
    featureGates: {
      summaries: gates.summaries !== false,
      actionItems: gates.action_items !== false,
      semanticSearch: gates.semantic_search === true,
      transcription: gates.transcription !== false,
    },
    modelDefaults: {
      asr: typeof defaults.asr === "string" ? defaults.asr : null,
      llm: typeof defaults.llm === "string" ? defaults.llm : null,
      embeddings: typeof defaults.embeddings === "string" ? defaults.embeddings : null,
    },
  };
}

export async function getAiPolicy(ctx: TenantContext): Promise<AiPolicy> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);
    return readPolicy(rows[0]?.settings);
  });
}

export async function updateAiPolicy(
  ctx: TenantContext,
  patch: {
    budgetCap?: number;
    featureGates?: Partial<AiPolicy["featureGates"]>;
    modelDefaults?: Partial<AiPolicy["modelDefaults"]>;
  },
) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);
    const current = readPolicy(rows[0]?.settings);
    const next: AiPolicy = {
      budgetCap: patch.budgetCap ?? current.budgetCap,
      featureGates: { ...current.featureGates, ...(patch.featureGates ?? {}) },
      modelDefaults: { ...current.modelDefaults, ...(patch.modelDefaults ?? {}) },
    };
    const settings = {
      ai_budget_cap: next.budgetCap,
      feature_gates: {
        summaries: next.featureGates.summaries,
        action_items: next.featureGates.actionItems,
        semantic_search: next.featureGates.semanticSearch,
        transcription: next.featureGates.transcription,
      },
      model_defaults: {
        asr: next.modelDefaults.asr,
        llm: next.modelDefaults.llm,
        embeddings: next.modelDefaults.embeddings,
      },
    };
    await tx
      .update(organizations)
      .set({ settings, updatedAt: new Date() })
      .where(eq(organizations.id, ctx.orgId));
    return next;
  });
}

/** Per-workspace provider overrides, used for bring-your-own-key installs. */
export async function listProviderConfigs(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: providerConfigs.id,
        kind: providerConfigs.kind,
        provider: providerConfigs.provider,
        baseUrl: providerConfigs.baseUrl,
        model: providerConfigs.model,
        options: providerConfigs.options,
        isDefault: providerConfigs.isDefault,
        status: providerConfigs.status,
        hasKey: sql<boolean>`${providerConfigs.apiKeyEnc} is not null`,
        updatedAt: providerConfigs.updatedAt,
      })
      .from(providerConfigs)
      .where(eq(providerConfigs.orgId, ctx.orgId))
      .orderBy(asc(providerConfigs.kind));
    return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
  });
}

export async function upsertProviderConfig(
  ctx: TenantContext,
  input: {
    kind: string;
    provider: string;
    baseUrl?: string | null;
    apiKeyEnc?: string | null;
    model?: string | null;
    status?: string;
    isDefault?: boolean;
    options?: Record<string, unknown>;
  },
) {
  return withTenant(ctx, async (tx) => {
    if (input.isDefault) {
      await tx
        .update(providerConfigs)
        .set({ isDefault: false })
        .where(and(eq(providerConfigs.orgId, ctx.orgId), eq(providerConfigs.kind, input.kind)));
    }
    const rows = await tx
      .insert(providerConfigs)
      .values({
        orgId: ctx.orgId,
        kind: input.kind as never,
        provider: input.provider,
        baseUrl: input.baseUrl ?? null,
        apiKeyEnc: input.apiKeyEnc ?? null,
        model: input.model ?? null,
        status: (input.status ?? "unconfigured") as never,
        isDefault: input.isDefault ?? true,
        options: input.options ?? {},
      })
      .onConflictDoUpdate({
        target: [providerConfigs.orgId, providerConfigs.kind, providerConfigs.provider],
        set: {
          baseUrl: input.baseUrl ?? null,
          apiKeyEnc: input.apiKeyEnc ?? null,
          model: input.model ?? null,
          status: (input.status ?? "unconfigured") as never,
          isDefault: input.isDefault ?? true,
          options: input.options ?? {},
          updatedAt: new Date(),
        },
      })
      .returning({ id: providerConfigs.id });
    return rows[0];
  });
}

export async function deleteProviderConfig(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(providerConfigs)
      .where(and(eq(providerConfigs.id, id), eq(providerConfigs.orgId, ctx.orgId)))
      .returning({ id: providerConfigs.id });
    return rows.length > 0;
  });
}

/**
 * Writes the cap onto the current period so the budget guard can read it
 * without a second lookup.
 */
export async function setUsageBudgetCap(ctx: TenantContext, cap: number) {
  return withTenant(ctx, async (tx) => {
    await tx.execute(sql`
      insert into usage_meters (org_id, period_start, period_end, budget_cap)
      values (
        ${ctx.orgId},
        date_trunc('month', now()),
        date_trunc('month', now()) + interval '1 month',
        ${cap}
      )
      on conflict (org_id, period_start) do update set budget_cap = excluded.budget_cap
    `);
    return true;
  });
}

export async function updateMemberRole(
  ctx: TenantContext,
  userId: string,
  patch: { role?: "owner" | "admin" | "member"; status?: "active" | "invited" | "deactivated" },
) {
  return withTenant(ctx, async (tx) => {
    const target = await tx
      .select({ role: memberships.role, status: memberships.status })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.orgId, ctx.orgId)))
      .limit(1);
    if (!target[0]) return { ok: false as const, reason: "not_found" as const };

    if (target[0].role === "owner" && (patch.role !== "owner" || patch.status === "deactivated")) {
      const owners = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(memberships)
        .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.role, "owner"), eq(memberships.status, "active")));
      if ((owners[0]?.n ?? 0) <= 1) return { ok: false as const, reason: "last_owner" as const };
    }

    const values: Record<string, unknown> = {};
    if (patch.role !== undefined) values.role = patch.role;
    if (patch.status !== undefined) values.status = patch.status;
    if (Object.keys(values).length > 0) {
      await tx
        .update(memberships)
        .set(values)
        .where(and(eq(memberships.userId, userId), eq(memberships.orgId, ctx.orgId)));
    }
    return { ok: true as const };
  });
}

export async function deleteActionItem(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.delete(actionItems).where(eq(actionItems.id, id)).returning({ id: actionItems.id });
    return rows.length > 0;
  });
}

export async function createFolder(
  ctx: TenantContext,
  input: {
    name: string;
    parentId?: string | null;
    spaceId?: string | null;
    icon?: string | null;
    description?: string | null;
  },
) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(folders)
      .values({
        orgId: ctx.orgId,
        name: input.name.slice(0, 120),
        parentId: input.parentId ?? null,
        spaceId: input.spaceId ?? null,
        icon: input.icon ?? "folder",
        description: input.description ?? null,
        ownerId: ctx.userId,
      })
      .returning({ id: folders.id, name: folders.name, parentId: folders.parentId, spaceId: folders.spaceId });
    return rows[0];
  });
}

export async function createChannel(
  ctx: TenantContext,
  input: { name: string; visibility: "public" | "private"; description?: string | null },
) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(channels)
      .values({
        orgId: ctx.orgId,
        name: input.name.slice(0, 120),
        visibility: input.visibility,
        description: input.description ?? null,
      })
      .returning({ id: channels.id, name: channels.name, visibility: channels.visibility });
    return rows[0];
  });
}

export async function updateActionItem(
  ctx: TenantContext,
  id: string,
  patch: {
    text?: string;
    assigneeName?: string | null;
    dueAt?: Date | null;
    status?: "open" | "done" | "cancelled";
  },
) {
  return withTenant(ctx, async (tx) => {
    const values: Record<string, unknown> = {};
    if (patch.text !== undefined) values.text = patch.text.slice(0, 2000);
    if (patch.assigneeName !== undefined) values.assigneeName = patch.assigneeName;
    if (patch.dueAt !== undefined) values.dueAt = patch.dueAt;
    if (patch.status !== undefined) {
      values.status = patch.status;
      values.completedAt = patch.status === "done" ? new Date() : null;
    }
    if (Object.keys(values).length === 0) return true;
    const rows = await tx
      .update(actionItems)
      .set(values)
      .where(eq(actionItems.id, id))
      .returning({ id: actionItems.id });
    return rows.length > 0;
  });
}

export async function updateProfile(
  ctx: TenantContext,
  patch: { name?: string; locale?: string; timezone?: string; avatarUrl?: string | null },
) {
  return withTenant(ctx, async (tx) => {
    const values: Record<string, unknown> = {};
    if (patch.name !== undefined) values.name = patch.name.slice(0, 120);
    if (patch.locale !== undefined) values.locale = patch.locale.slice(0, 20);
    if (patch.timezone !== undefined) values.timezone = patch.timezone.slice(0, 60);
    if (patch.avatarUrl !== undefined) values.avatarUrl = patch.avatarUrl;
    if (Object.keys(values).length > 0) {
      await tx.update(users).set(values).where(eq(users.id, ctx.userId));
    }
    return true;
  });
}
