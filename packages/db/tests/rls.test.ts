/**
 * RLS isolation test.
 *
 * Creates a throwaway organization with its own meeting, then asserts that a
 * tenant query for the demo organization cannot see it, and that the second
 * organization cannot see the demo organization's data. Run against a migrated
 * database:
 *
 *   DATABASE_URL=postgres://... pnpm --filter @click/db test:rls
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { pool, withTenant } from "../src/client";
import { meetings, organizations, users, memberships } from "../src/schema";
import { eq } from "drizzle-orm";

const DEMO_ORG = "11111111-1111-4111-8111-111111111111";
const DEMO_USER = "22222222-2222-4222-8222-222222222222";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const admin = new Client({ connectionString });
await admin.connect();

const otherOrgId = randomUUID();
const otherUserId = randomUUID();
const otherMeetingId = randomUUID();

async function cleanup() {
  await admin.query("delete from organizations where id = $1", [otherOrgId]);
  await pool.end();
  await admin.end();
}

try {
  await admin.query(
    `insert into organizations (id, name, slug) values ($1, 'RLS Test Org', $2)`,
    [otherOrgId, `rls-test-${otherOrgId.slice(0, 8)}`],
  );
  await admin.query(
    `insert into users (id, email, name) values ($1, $2, 'RLS Tester')`,
    [otherUserId, `rls-${otherUserId.slice(0, 8)}@test.local`],
  );
  await admin.query(
    `insert into memberships (org_id, user_id, role, status) values ($1, $2, 'owner', 'active')`,
    [otherOrgId, otherUserId],
  );
  await admin.query(
    `insert into meetings (id, org_id, owner_id, title, source, status, started_at)
     values ($1, $2, $3, 'RLS isolation meeting', 'upload', 'ready', now())`,
    [otherMeetingId, otherOrgId, otherUserId],
  );

  // 1. The demo tenant sees its own meetings.
  const demoSeen = await withTenant(
    { orgId: DEMO_ORG, userId: DEMO_USER },
    async (tx) => {
      const rows = await tx.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, otherMeetingId));
      return rows.length;
    },
  );
  assert.equal(demoSeen, 0, "demo org must not see another org's meeting");

  // 2. The other tenant cannot see the demo org's meetings either.
  const otherSeenDemo = await withTenant(
    { orgId: otherOrgId, userId: otherUserId },
    async (tx) => {
      const rows = await tx.select({ id: meetings.id }).from(meetings);
      return rows.filter((row) => row.id !== otherMeetingId).length;
    },
  );
  assert.equal(otherSeenDemo, 0, "second org must not see demo org meetings");

  // 3. The other tenant sees exactly its own meeting.
  const otherOwn = await withTenant(
    { orgId: otherOrgId, userId: otherUserId },
    async (tx) => {
      const rows = await tx.select({ id: meetings.id }).from(meetings);
      return rows.map((row) => row.id);
    },
  );
  assert.deepEqual(otherOwn, [otherMeetingId], "second org sees only its own meeting");

  // 4. Cross-tenant writes are rejected by the WITH CHECK clause.
  let rejected = false;
  try {
    await withTenant({ orgId: DEMO_ORG, userId: DEMO_USER }, async (tx) => {
      await tx.insert(meetings).values({
        orgId: otherOrgId,
        ownerId: otherUserId,
        title: "cross tenant insert",
        source: "upload",
        status: "ready",
      });
    });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, "inserting into another org must be rejected");

  // 5. The organizations table is scoped too.
  const orgsSeen = await withTenant(
    { orgId: otherOrgId, userId: otherUserId },
    async (tx) => {
      const rows = await tx.select({ id: organizations.id }).from(organizations);
      return rows.map((row) => row.id);
    },
  );
  assert.deepEqual(orgsSeen, [otherOrgId], "organizations table is RLS-scoped");

  console.log("ok - RLS isolation holds across organizations");
} finally {
  await cleanup();
}
