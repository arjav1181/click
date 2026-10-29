#!/usr/bin/env node
import "./load-env";
/**
 * Seeds a demo workspace. Safe to re-run: every insert is keyed and idempotent.
 * Usage: DATABASE_URL=... pnpm --filter @click/db seed
 */
import { Client } from "pg";
import { hashPassword } from "./password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const IDS = {
  org: "11111111-1111-4111-8111-111111111111",
  ava: "22222222-2222-4222-8222-222222222222",
  sam: "33333333-3333-4333-8333-333333333333",
  maya: "44444444-4444-4444-8444-444444444444",
  jordan: "55555555-5555-4555-8555-555555555555",
  folder: "66666666-6666-4666-8666-666666666666",
  channel: "77777777-7777-4777-8777-777777777777",
  meeting1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  meeting2: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  meeting3: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  meeting4: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  transcript1: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  transcript2: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  note1: "99999999-9999-4999-8999-999999999999",
  providerAsr: "12121212-1212-4121-8121-121212121212",
  providerLlm: "13131313-1313-4131-8131-131313131313",
  retention: "14141414-1414-4141-8141-141414141414",
};

const now = Date.now();
const at = (days: number, hour = 10) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

const client = new Client({ connectionString, application_name: "click-seed" });
await client.connect();

const q = (text: string, values: unknown[] = []) => client.query(text, values);

await q(
  `insert into organizations (id, name, slug, domain_allowlist, settings)
   values ($1,'Click Demo','demo','{}','{"ai_budget_cap":50}')
   on conflict (id) do nothing`,
  [IDS.org],
);

const passwordHash = await hashPassword(process.env.SEED_PASSWORD ?? "click-demo-2026");
for (const [id, email, name] of [
  [IDS.ava, "ava@click.local", "Ava Chen"],
  [IDS.sam, "sam@click.local", "Sam Park"],
  [IDS.maya, "maya@click.local", "Maya Iyer"],
  [IDS.jordan, "jordan@click.local", "Jordan Lee"],
]) {
  await q(
    `insert into users (id, email, name, password_hash, timezone)
     values ($1,$2,$3,$4,'UTC') on conflict (email) do nothing`,
    [id, email, name, passwordHash],
  );
}

for (const [userId, role, status] of [
  [IDS.ava, "owner", "active"],
  [IDS.sam, "admin", "active"],
  [IDS.maya, "member", "active"],
  [IDS.jordan, "member", "invited"],
] as const) {
  await q(
    `insert into memberships (org_id, user_id, role, status)
     values ($1,$2,$3,$4) on conflict (org_id, user_id) do nothing`,
    [IDS.org, userId, role, status],
  );
}

await q(
  `insert into retention_policies (id, org_id, transcript_days, audio_days, recording_mode)
   values ($1,$2,90,30,'audio') on conflict (org_id) do nothing`,
  [IDS.retention, IDS.org],
);

await q(
  `insert into folders (id, org_id, name, icon, owner_id)
   values ($1,$2,'Product','folder',$3) on conflict do nothing`,
  [IDS.folder, IDS.org, IDS.ava],
);

await q(
  `insert into channels (id, org_id, name, visibility)
   values ($1,$2,'launch','public') on conflict do nothing`,
  [IDS.channel, IDS.org],
);

await q(
  `insert into provider_configs (id, org_id, kind, provider, model, options, is_default, status)
   values
     ($1,$2,'asr','mock','mock-v1','{}',true,'ok'),
     ($3,$2,'llm','mock','mock-summary','{}',true,'ok')
   on conflict do nothing`,
  [IDS.providerAsr, IDS.org, IDS.providerLlm],
);

const meetings = [
  {
    id: IDS.meeting1,
    title: "Q3 planning sync",
    start: at(-2, 10),
    end: at(-2, 10.7),
    duration: 2520,
    source: "bot",
    status: "ready",
    privacy: "workspace",
    consent: "acknowledged",
  },
  {
    id: IDS.meeting2,
    title: "Customer call — Acme Corp",
    start: at(-1, 14),
    end: at(-1, 14.3),
    duration: 1080,
    source: "bot",
    status: "ready",
    privacy: "private",
    consent: "acknowledged",
  },
  {
    id: IDS.meeting3,
    title: "Engineering retro",
    start: at(-5, 16),
    end: at(-5, 17),
    duration: 3600,
    source: "upload",
    status: "ready",
    privacy: "workspace",
    consent: "acknowledged",
  },
  {
    id: IDS.meeting4,
    title: "Design review — onboarding",
    start: at(-3, 9.5),
    end: at(-3, 10.2),
    duration: 2520,
    source: "bot",
    status: "processing",
    privacy: "private",
    consent: "acknowledged",
  },
];

for (const m of meetings) {
  await q(
    `insert into meetings
       (id, org_id, owner_id, title, started_at, ended_at, duration_s, source, status, privacy, consent_state, language)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'en')
     on conflict (id) do nothing`,
    [m.id, IDS.org, IDS.ava, m.title, m.start, m.end, m.duration, m.source, m.status, m.privacy, m.consent],
  );
}

await q(
  `insert into meeting_folders (meeting_id, folder_id) values ($1,$2), ($3,$2) on conflict do nothing`,
  [IDS.meeting1, IDS.folder, IDS.meeting4],
);
await q(
  `insert into meeting_channels (meeting_id, channel_id) values ($1,$2), ($3,$2) on conflict do nothing`,
  [IDS.meeting1, IDS.channel, IDS.meeting4],
);

for (const [id, meetingId, provider] of [
  [IDS.transcript1, IDS.meeting1, "mock"],
  [IDS.transcript2, IDS.meeting2, "mock"],
] as const) {
  await q(
    `insert into transcripts (id, org_id, meeting_id, language, provider, model, status, word_count)
     values ($1,$2,$3,'en',$4,'mock-v1','ready',120) on conflict (meeting_id) do nothing`,
    [id, IDS.org, meetingId, provider],
  );
}

const speakers = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "Ava", email: "ava@click.local", me: true },
  { id: "a0000000-0000-4000-8000-000000000002", name: "Sam", email: "sam@click.local", me: false },
  { id: "a0000000-0000-4000-8000-000000000003", name: "Maya", email: "maya@click.local", me: false },
  { id: "a0000000-0000-4000-8000-000000000004", name: "Dana (Acme)", email: "dana@acme.example", me: false },
];
for (const s of speakers) {
  await q(
    `insert into speakers (id, org_id, name, email, is_me) values ($1,$2,$3,$4,$5) on conflict do nothing`,
    [s.id, IDS.org, s.name, s.email, s.me],
  );
}

const segments1 = [
  ["Let's lock the launch date. I'd suggest the 14th so marketing has a week to prepare.", 0, 6200, speakers[0].id, ["task"]],
  ["Works for me. Can we also confirm the onboarding flow is finished by then?", 6200, 11200, speakers[1].id, ["question", "task"]],
  ["The onboarding screens are done. I still need to wire up the calendar connection, but that should ship this week.", 11200, 18400, speakers[2].id, []],
  ["Great. One thing on pricing — we agreed no paywalls, but we still need the budget cap to ship with the release.", 18400, 26100, speakers[0].id, ["pricing"]],
  ["Right. The budget cap is in the admin panel already. I'll double check the default value before we ship.", 26100, 33100, speakers[1].id, ["task"]],
  ["And the AI provider setup — we need docs for self-hosters. Let's assign that as an action item.", 33100, 41000, speakers[0].id, ["task"]],
] as const;
for (const [i, [text, startMs, endMs, speakerId, flags]] of segments1.entries()) {
  await q(
    `insert into transcript_segments
       (org_id, transcript_id, idx, speaker_id, start_ms, end_ms, text, raw_text, confidence, flags)
     values ($1,$2,$3,$4,$5,$6,$7,$7,0.95,$8)
     on conflict (transcript_id, idx) do nothing`,
    [IDS.org, IDS.transcript1, i, speakerId, startMs, endMs, text, JSON.stringify({ tags: flags })],
  );
}

const segments2 = [
  ["Thanks for joining. The main thing I want to cover is how the self-hosted install behaves for your team.", 0, 7000, speakers[0].id],
  ["We are mostly on Google Meet. Will the bot join our calls?", 7000, 15000, speakers[3].id],
  ["Meet has no public bot API, so on Meet we capture through the browser extension or the desktop client. Zoom and Teams use official bot paths.", 15000, 25000, speakers[0].id],
] as const;
for (const [i, [text, startMs, endMs, speakerId]] of segments2.entries()) {
  await q(
    `insert into transcript_segments
       (org_id, transcript_id, idx, speaker_id, start_ms, end_ms, text, raw_text, confidence, flags)
     values ($1,$2,$3,$4,$5,$6,$7,$7,0.93,'{}') on conflict (transcript_id, idx) do nothing`,
    [IDS.org, IDS.transcript2, i, speakerId, startMs, endMs, text],
  );
}

await q(
  `insert into notes (id, org_id, meeting_id, author_id, raw_markdown, status, template_id, model, generated_at, version)
   values ($1,$2,$3,$4,$5,'ready',(select id from templates where is_builtin order by name limit 1),'mock-summary',$6,2)
   on conflict (meeting_id, author_id) do nothing`,
  [
    IDS.note1,
    IDS.org,
    IDS.meeting1,
    IDS.ava,
    "## Launch\n- aim for the 14th\n- marketing needs a week\n\n## Onboarding\n- screens done, calendar connection pending\n\n## Pricing\n- no paywalls; budget cap must ship",
    at(-2, 11),
  ],
);

const section = await q(
  `insert into note_sections (org_id, note_id, key, title, body_markdown, order_index, source)
   values ($1,$2,'overview','Overview',$3,0,'ai')
   on conflict (note_id, key) do update set body_markdown = excluded.body_markdown
   returning id`,
  [
    IDS.org,
    IDS.note1,
    "The team agreed to target the 14th for launch, giving marketing a week to prepare. Onboarding screens are complete, with the calendar connection still pending. Pricing stays free of paywalls, but the operator budget cap must ship with the release, and self-hoster provider docs need an owner.",
  ],
);
await q(
  `insert into note_sections (org_id, note_id, key, title, body_markdown, order_index, source)
   values ($1,$2,'actions','Action items',$3,1,'ai')
   on conflict (note_id, key) do update set body_markdown = excluded.body_markdown`,
  [
    IDS.org,
    IDS.note1,
    "- Confirm the onboarding flow is finished before the 14th (Sam)\n- Double check the default budget cap value (Sam)\n- Write self-hoster provider setup docs (Ava)",
  ],
);

const seg = await client.query<{ id: string }>(
  `select id from transcript_segments where transcript_id = $1 order by idx limit 1`,
  [IDS.transcript1],
);
if (seg.rows[0]) {
  await q(
    `insert into citations (org_id, note_id, section_id, segment_id, quote, start_ms, origin, label)
     values ($1,$2,$3,$4,$5,0,'ai','00:00') on conflict do nothing`,
    [IDS.org, IDS.note1, section.rows[0].id, seg.rows[0].id, "Let's lock the launch date. I'd suggest the 14th"],
  );
}

const actions = [
  ["Confirm the onboarding flow is finished before the 14th", "Sam Park", at(10, 9), "open"],
  ["Double check the default budget cap value", "Sam Park", at(3, 9), "open"],
  ["Write self-hoster provider setup docs", "Ava Chen", at(7, 9), "open"],
  ["Add retry with backoff to the transcription worker", "Sam Park", at(-1, 9), "done"],
];
for (const [text, assignee, due, status] of actions) {
  const exists = await q(`select 1 from action_items where meeting_id = $1 and text = $2`, [
    IDS.meeting1,
    text,
  ]);
  if ((exists.rowCount ?? 0) === 0) {
    await q(
      `insert into action_items (org_id, meeting_id, text, assignee_name, due_at, status)
       values ($1,$2,$3,$4,$5,$6)`,
      [IDS.org, IDS.meeting1, text, assignee, due, status],
    );
  }
}

await q(
  `insert into usage_meters (org_id, period_start, period_end, asr_seconds, llm_tokens_in, llm_tokens_out, cost_estimate, budget_cap)
   select $1, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', 48230, 1240000, 312000, 14.82, 50
   where not exists (select 1 from usage_meters where org_id = $1 and period_start = date_trunc('month', now()))`,
  [IDS.org],
);

await q(
  `insert into audit_events (org_id, actor_id, action, target_type, target_id, metadata, ip)
   select $1,$2,'meeting.created','meeting',$3,'{}','127.0.0.1'
   where not exists (select 1 from audit_events where org_id = $1 and action = 'meeting.created')`,
  [IDS.org, IDS.ava, IDS.meeting1],
);

console.log("seeded demo workspace");
console.log("  org:   demo");
console.log("  users: ava@click.local / sam@click.local / maya@click.local");
console.log(`  password: ${process.env.SEED_PASSWORD ?? "click-demo-2026"}`);
await client.end();
