import { and, asc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { groupMembers, groups, users } from "../schema";

export interface GroupMemberRow {
  id: string;
  name: string;
  email: string;
}

export interface GroupRow {
  id: string;
  name: string;
  priority: number;
  templateId: string | null;
  members: GroupMemberRow[];
  createdAt: string;
}

export async function listGroups(ctx: TenantContext): Promise<GroupRow[]> {
  return withTenant(ctx, async (tx) => {
    const groupRows = await tx
      .select({
        id: groups.id,
        name: groups.name,
        priority: groups.priority,
        templateId: groups.templateId,
        createdAt: groups.createdAt,
      })
      .from(groups)
      .where(eq(groups.orgId, ctx.orgId))
      .orderBy(asc(groups.priority), asc(groups.name));

    const result: GroupRow[] = [];
    for (const group of groupRows) {
      const memberRows = await tx
        .select({ id: users.id, name: users.name, email: users.email })
        .from(groupMembers)
        .innerJoin(users, eq(users.id, groupMembers.userId))
        .where(eq(groupMembers.groupId, group.id))
        .orderBy(asc(users.name));
      result.push({
        id: group.id,
        name: group.name,
        priority: group.priority,
        templateId: group.templateId,
        members: memberRows,
        createdAt: group.createdAt.toISOString(),
      });
    }
    return result;
  });
}

export async function createGroup(ctx: TenantContext, input: { name: string; priority?: number }): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(groups)
      .values({
        orgId: ctx.orgId,
        name: input.name.slice(0, 120),
        priority: input.priority ?? 0,
      })
      .returning({ id: groups.id });
    return { id: rows[0].id };
  });
}

export async function updateGroup(
  ctx: TenantContext,
  id: string,
  patch: { name?: string; priority?: number; templateId?: string | null },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, id), eq(groups.orgId, ctx.orgId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    const values: Record<string, unknown> = {};
    if (patch.name !== undefined) values.name = patch.name.slice(0, 120);
    if (patch.priority !== undefined) values.priority = patch.priority;
    if (patch.templateId !== undefined) values.templateId = patch.templateId;
    if (Object.keys(values).length > 0) {
      await tx.update(groups).set(values).where(eq(groups.id, id));
    }
    return { ok: true };
  });
}

export async function deleteGroup(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(groups)
      .where(and(eq(groups.id, id), eq(groups.orgId, ctx.orgId)))
      .returning({ id: groups.id });
    return { ok: rows.length > 0 };
  });
}

export async function addGroupMember(ctx: TenantContext, groupId: string, userId: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const group = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.orgId, ctx.orgId)))
      .limit(1);
    if (!group[0]) return { ok: false };
    await tx
      .insert(groupMembers)
      .values({ groupId, userId })
      .onConflictDoNothing();
    return { ok: true };
  });
}

export async function removeGroupMember(ctx: TenantContext, groupId: string, userId: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    return { ok: true };
  });
}
