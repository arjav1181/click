import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { companies, meetings, people } from "../schema";

export interface PersonRow {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  companyId: string | null;
  companyName: string | null;
  avatarUrl: string | null;
  meetingCount: number;
}

export interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  peopleCount: number;
  meetingCount: number;
}

export async function listPeople(ctx: TenantContext, q?: string): Promise<PersonRow[]> {
  return withTenant(ctx, async (tx) => {
    const conditions = [eq(people.orgId, ctx.orgId)];
    if (q) conditions.push(ilike(people.name, `%${q}%`));
    const rows = await tx
      .select({
        id: people.id,
        name: people.name,
        email: people.email,
        title: people.title,
        companyId: people.companyId,
        companyName: sql<string | null>`(select c.name from companies c where c.id = ${people.companyId})`,
        avatarUrl: people.avatarUrl,
      })
      .from(people)
      .where(and(...conditions))
      .orderBy(asc(people.name));
    const result: PersonRow[] = [];
    for (const row of rows) {
      const mc = await tx.execute(sql`
        select count(*)::int as n from meeting_participants mp where mp.org_id = ${ctx.orgId} and (mp.user_id = ${row.id}::uuid or mp.email = ${row.email})
      `);
      result.push({
        id: row.id,
        name: row.name,
        email: row.email,
        title: row.title,
        companyId: row.companyId,
        companyName: row.companyName,
        avatarUrl: row.avatarUrl,
        meetingCount: Number((mc.rows as Array<{ n: number }>)[0]?.n ?? 0),
      });
    }
    return result;
  });
}

export async function listCompanies(ctx: TenantContext, q?: string): Promise<CompanyRow[]> {
  return withTenant(ctx, async (tx) => {
    const conditions = [eq(companies.orgId, ctx.orgId)];
    if (q) conditions.push(ilike(companies.name, `%${q}%`));
    const rows = await tx
      .select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
      })
      .from(companies)
      .where(and(...conditions))
      .orderBy(asc(companies.name));
    const result: CompanyRow[] = [];
    for (const row of rows) {
      const pc = await tx.execute(sql`select count(*)::int as n from people p where p.company_id = ${row.id}`);
      const mc = await tx.execute(sql`
        select count(distinct mp.meeting_id)::int as n
        from meeting_participants mp
        inner join people p on p.id = ${row.id}::uuid
        where mp.org_id = ${ctx.orgId}
      `);
      result.push({
        id: row.id,
        name: row.name,
        domain: row.domain,
        peopleCount: Number((pc.rows as Array<{ n: number }>)[0]?.n ?? 0),
        meetingCount: Number((mc.rows as Array<{ n: number }>)[0]?.n ?? 0),
      });
    }
    return result;
  });
}
