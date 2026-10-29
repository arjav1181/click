#!/usr/bin/env node
import "./load-env";
/**
 * Operator CLI. Runs with the schema owner connection, outside the app roles.
 *
 *   pnpm --filter @click/db cli create-admin <email> <password> [name]
 *   pnpm --filter @click/db cli reset-password <email> <password>
 *   pnpm --filter @click/db cli verify-email <email>
 *   pnpm --filter @click/db cli invite <org-slug> <email> [role]
 */
import { Client } from "pg";
import { hashPassword, passwordProblem, randomToken, sha256 } from "./password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
const client = new Client({ connectionString, application_name: "click-cli" });
await client.connect();

const die = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";

async function createAdmin(email: string, password: string, name?: string) {
  const problem = passwordProblem(password);
  if (problem) die(problem);
  const passwordHash = await hashPassword(password);

  const user = await client.query<{ id: string }>(
    `insert into users (email, name, password_hash, email_verified_at)
     values ($1,$2,$3,now())
     on conflict (email) do update
       set password_hash = excluded.password_hash, email_verified_at = now()
     returning id`,
    [email.toLowerCase(), name ?? email.split("@")[0], passwordHash],
  );
  const userId = user.rows[0].id;

  const existing = await client.query<{ org_id: string }>(
    "select org_id from memberships where user_id = $1 and role = 'owner' limit 1",
    [userId],
  );
  if (existing.rowCount === 0) {
    const org = await client.query<{ id: string }>(
      `insert into organizations (name, slug) values ($1,$2) returning id`,
      [`${name ?? email.split("@")[0]}'s workspace`, slugify(`${email.split("@")[0]}-${randomToken(2)}`)],
    );
    await client.query(
      `insert into memberships (org_id, user_id, role, status) values ($1,$2,'owner','active')`,
      [org.rows[0].id, userId],
    );
    await client.query(
      `insert into retention_policies (org_id) values ($1) on conflict (org_id) do nothing`,
      [org.rows[0].id],
    );
    console.log(`created ${email} as owner of ${org.rows[0].id}`);
  } else {
    console.log(`created ${email} in existing org ${existing.rows[0].org_id}`);
  }
}

async function resetPassword(email: string, password: string) {
  const problem = passwordProblem(password);
  if (problem) die(problem);
  const passwordHash = await hashPassword(password);
  const result = await client.query(
    `update users set password_hash = $2, updated_at = now() where email = $1`,
    [email.toLowerCase(), passwordHash],
  );
  if (result.rowCount === 0) die(`no user with email ${email}`);
  await client.query(
    `delete from sessions where user_id in (select id from users where email = $1)`,
    [email.toLowerCase()],
  );
  console.log(`password updated for ${email}; all sessions revoked`);
}

async function verifyEmail(email: string) {
  const result = await client.query(
    `update users set email_verified_at = coalesce(email_verified_at, now()) where email = $1`,
    [email.toLowerCase()],
  );
  if (result.rowCount === 0) die(`no user with email ${email}`);
  console.log(`email verified for ${email}`);
}

async function invite(orgSlug: string, email: string, role = "member") {
  if (!["owner", "admin", "member"].includes(role)) die("role must be owner, admin or member");
  const org = await client.query<{ id: string }>("select id from organizations where slug = $1", [
    orgSlug,
  ]);
  if (org.rowCount === 0) die(`no org with slug ${orgSlug}`);
  const owner = await client.query<{ user_id: string }>(
    "select user_id from memberships where org_id = $1 and role = 'owner' limit 1",
    [org.rows[0].id],
  );
  if (owner.rowCount === 0) die("org has no owner to attribute the invitation to");
  const token = randomToken(32);
  await client.query(
    `insert into invitations (org_id, email, role, token_hash, invited_by, expires_at)
     values ($1,$2,$3,$4,$5, now() + interval '7 days')`,
    [org.rows[0].id, email.toLowerCase(), role, sha256(token), owner.rows[0].user_id],
  );
  console.log(`invitation token for ${email} (valid 7 days, single use):`);
  console.log(token);
}

switch (command) {
  case "create-admin":
    if (args.length < 2) die("usage: cli create-admin <email> <password> [name]");
    await createAdmin(args[0], args[1], args[2]);
    break;
  case "reset-password":
    if (args.length < 2) die("usage: cli reset-password <email> <password>");
    await resetPassword(args[0], args[1]);
    break;
  case "verify-email":
    if (args.length < 1) die("usage: cli verify-email <email>");
    await verifyEmail(args[0]);
    break;
  case "invite":
    if (args.length < 2) die("usage: cli invite <org-slug> <email> [role]");
    await invite(args[0], args[1], args[2]);
    break;
  default:
    die(
      [
        "commands:",
        "  create-admin <email> <password> [name]",
        "  reset-password <email> <password>",
        "  verify-email <email>",
        "  invite <org-slug> <email> [role]",
      ].join("\n"),
    );
}

await client.end();
