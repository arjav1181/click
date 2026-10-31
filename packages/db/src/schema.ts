// Generated from replica/schema.sql by packages/db/scripts/generate-schema.mjs.
// Do not hand-edit table shapes: change the SQL, then regenerate.
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  numeric,
  inet,
  customType,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
});
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  logoUrl: text("logo_url"),
  domainAllowlist: text("domain_allowlist").array().notNull().default([]),
  settings: jsonb("settings").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  avatarUrl: text("avatar_url"),
  locale: text("locale").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const authIdentities = pgTable("auth_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  metadata: jsonb("metadata").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ip: inet("ip"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  tokenHash: text("token_hash").notNull(),
  invitedBy: uuid("invited_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  priority: integer("priority").notNull().default(0),
  templateId: uuid("template_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull(),
  userId: uuid("user_id").notNull()
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const calendarConnections = pgTable("calendar_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  accountEmail: text("account_email").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  syncCursor: text("sync_cursor"),
  status: text("status").notNull().default("connected"),
  autoJoin: boolean("auto_join").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  connectionId: uuid("connection_id").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title"),
  description: text("description"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  organizerEmail: text("organizer_email"),
  attendees: jsonb("attendees").notNull().default("[]"),
  meetingUrl: text("meeting_url"),
  provider: text("provider"),
  autoJoin: boolean("auto_join"),
  botStatus: text("bot_status").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const calendarRules = pgTable("calendar_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  connectionId: uuid("connection_id"),
  titlePattern: text("title_pattern"),
  hostPattern: text("host_pattern"),
  attendeeEmail: text("attendee_email"),
  autoJoin: boolean("auto_join").notNull().default(true),
  priority: integer("priority").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  ownerId: uuid("owner_id").notNull(),
  calendarEventId: uuid("calendar_event_id"),
  title: text("title").notNull().default("Untitled meeting"),
  description: text("description"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationS: integer("duration_s"),
  language: text("language").notNull().default("en"),
  source: text("source").notNull(),
  status: text("status").notNull().default("scheduled"),
  privacy: text("privacy").notNull().default("private"),
  consentState: text("consent_state").notNull().default("pending"),
  retentionState: text("retention_state").notNull().default("active"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

export const meetingParticipants = pgTable("meeting_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  userId: uuid("user_id"),
  displayName: text("display_name"),
  email: text("email"),
  speakerId: uuid("speaker_id"),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  leftAt: timestamp("left_at", { withTimezone: true }),
  isOrganizer: boolean("is_organizer").notNull().default(false)
});

export const botJobs = pgTable("bot_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  provider: text("provider").notNull(),
  meetingUrl: text("meeting_url").notNull(),
  botName: text("bot_name").notNull().default("Click Notetaker"),
  state: text("state").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  lobbyReason: text("lobby_reason"),
  errorCode: text("error_code"),
  calendarEventId: uuid("calendar_event_id"),
  providerConfig: jsonb("provider_config").notNull().default("{}"),
  consentNoticeSentAt: timestamp("consent_notice_sent_at", { withTimezone: true }),
  noShowNotifiedAt: timestamp("no_show_notified_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  storageKey: text("storage_key").notNull(),
  kind: text("kind").notNull(),
  codec: text("codec"),
  durationS: integer("duration_s"),
  sizeBytes: bigint("size_bytes", { mode: 'number' }),
  checksum: text("checksum"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const transcripts = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  language: text("language").notNull().default("en"),
  provider: text("provider"),
  model: text("model"),
  status: text("status").notNull().default("pending"),
  wordCount: integer("word_count").notNull().default(0),
  confidenceAvg: numeric("confidence_avg"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const speakers = pgTable("speakers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name"),
  email: text("email"),
  isMe: boolean("is_me").notNull().default(false),
  voiceProfileRef: text("voice_profile_ref"),
  mergedIntoId: uuid("merged_into_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const transcriptSegments = pgTable("transcript_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  transcriptId: uuid("transcript_id").notNull(),
  idx: integer("idx").notNull(),
  speakerId: uuid("speaker_id"),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  text: text("text").notNull(),
  rawText: text("raw_text"),
  edited: boolean("edited").notNull().default(false),
  confidence: numeric("confidence"),
  sentiment: numeric("sentiment"),
  flags: jsonb("flags").notNull().default("{}"),
  searchTsv: tsvector("search_tsv"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const vocabularyTerms = pgTable("vocabulary_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id"),
  term: text("term").notNull(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const embeddings = pgTable("embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  objectType: text("object_type").notNull(),
  objectId: uuid("object_id").notNull(),
  model: text("model").notNull(),
  embedding: vector("embedding").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id"),
  ownerId: uuid("owner_id"),
  name: text("name").notNull(),
  description: text("description"),
  sections: jsonb("sections").notNull().default("[]"),
  prompt: text("prompt"),
  scope: text("scope").notNull().default("personal"),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  authorId: uuid("author_id").notNull(),
  rawMarkdown: text("raw_markdown").notNull().default(""),
  enhancedMarkdown: text("enhanced_markdown"),
  status: text("status").notNull().default("draft"),
  templateId: uuid("template_id"),
  model: text("model"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const noteSections = pgTable("note_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  noteId: uuid("note_id").notNull(),
  key: text("key").notNull(),
  title: text("title").notNull(),
  bodyMarkdown: text("body_markdown").notNull().default(""),
  orderIndex: integer("order_index").notNull().default(0),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const citations = pgTable("citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  noteId: uuid("note_id").notNull(),
  sectionId: uuid("section_id"),
  segmentId: uuid("segment_id"),
  quote: text("quote").notNull(),
  startMs: integer("start_ms"),
  origin: text("origin").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  scope: text("scope").notNull(),
  model: text("model"),
  visibility: text("visibility").notNull().default("private"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  recipeId: uuid("recipe_id").notNull(),
  trigger: text("trigger").notNull().default("manual"),
  targetFilter: jsonb("target_filter").notNull().default("{}"),
  outputTargets: jsonb("output_targets").notNull().default("[]"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const skillRuns = pgTable("skill_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  skillId: uuid("skill_id").notNull(),
  meetingIds: uuid("meeting_ids").array().notNull().default([]),
  status: text("status").notNull().default("queued"),
  outputMarkdown: text("output_markdown"),
  error: text("error"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const chatThreads = pgTable("chat_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id").notNull(),
  scope: text("scope").notNull().default("global"),
  scopeIds: uuid("scope_ids").array().notNull().default([]),
  mode: text("mode").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  threadId: uuid("thread_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model: text("model"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  citations: jsonb("citations").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const actionItems = pgTable("action_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  ownerUserId: uuid("owner_user_id"),
  assigneeName: text("assignee_name"),
  text: text("text").notNull(),
  status: text("status").notNull().default("open"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  sourceSegmentId: uuid("source_segment_id"),
  pushedRefs: jsonb("pushed_refs").notNull().default("[]"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  userId: uuid("user_id").notNull(),
  segmentId: uuid("segment_id"),
  parentId: uuid("parent_id"),
  body: text("body").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const highlights = pgTable("highlights", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  userId: uuid("user_id").notNull(),
  segmentId: uuid("segment_id").notNull(),
  color: text("color").notNull().default("yellow"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  userId: uuid("user_id").notNull(),
  segmentId: uuid("segment_id"),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const soundbites = pgTable("soundbites", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  createdBy: uuid("created_by").notNull(),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  title: text("title"),
  storageKey: text("storage_key"),
  autoGenerated: boolean("auto_generated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  visibility: text("visibility").notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const playlistItems = pgTable("playlist_items", {
  playlistId: uuid("playlist_id").notNull(),
  soundbiteId: uuid("soundbite_id").notNull(),
  position: integer("position").notNull().default(0)
});

export const spaces = pgTable("spaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  description: text("description"),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  spaceId: uuid("space_id"),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  icon: text("icon"),
  description: text("description"),
  ownerId: uuid("owner_id").notNull(),
  linkAccess: text("link_access").notNull().default("members"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const folderMembers = pgTable("folder_members", {
  folderId: uuid("folder_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull()
});

export const spaceMembers = pgTable("space_members", {
  spaceId: uuid("space_id").notNull(),
  userId: uuid("user_id").notNull()
});

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  visibility: text("visibility").notNull(),
  description: text("description"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const channelMembers = pgTable("channel_members", {
  channelId: uuid("channel_id").notNull(),
  userId: uuid("user_id").notNull()
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  domain: text("domain"),
  logoUrl: text("logo_url"),
  enrichment: jsonb("enrichment").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  title: text("title"),
  companyId: uuid("company_id"),
  avatarUrl: text("avatar_url"),
  enrichment: jsonb("enrichment").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  color: text("color")
});

export const meetingFolders = pgTable("meeting_folders", {
  meetingId: uuid("meeting_id").notNull(),
  folderId: uuid("folder_id").notNull(),
  addedBy: uuid("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const meetingChannels = pgTable("meeting_channels", {
  meetingId: uuid("meeting_id").notNull(),
  channelId: uuid("channel_id").notNull(),
  sharedBy: uuid("shared_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const meetingTags = pgTable("meeting_tags", {
  meetingId: uuid("meeting_id").notNull(),
  tagId: uuid("tag_id").notNull()
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  authKind: text("auth_kind").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  docsUrl: text("docs_url")
});

export const integrationConnections = pgTable("integration_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id"),
  integrationKey: text("integration_key").notNull(),
  credentialsEnc: text("credentials_enc"),
  config: jsonb("config").notNull().default("{}"),
  status: text("status").notNull().default("connected"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  url: text("url").notNull(),
  secretHash: text("secret_hash").notNull(),
  secretEnc: text("secret_enc"),
  events: text("events").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  endpointId: uuid("endpoint_id").notNull(),
  eventId: uuid("event_id").notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  responseCode: integer("response_code"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const emailDrafts = pgTable("email_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  userId: uuid("user_id").notNull(),
  toAddrs: text("to_addrs").array().notNull().default([]),
  ccAddrs: text("cc_addrs").array().notNull().default([]),
  bccAddrs: text("bcc_addrs").array().notNull().default([]),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  attachments: jsonb("attachments").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  userId: uuid("user_id").notNull(),
  bullets: jsonb("bullets").notNull().default("[]"),
  sources: jsonb("sources").notNull().default("[]"),
  feedback: integer("feedback"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow()
});

export const retentionPolicies = pgTable("retention_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  transcriptDays: integer("transcript_days"),
  audioDays: integer("audio_days"),
  recordingMode: text("recording_mode").notNull().default("audio"),
  legalHoldOverride: boolean("legal_hold_override").notNull().default(false),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const legalHolds = pgTable("legal_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  custodianIds: uuid("custodian_ids").array().notNull().default([]),
  scope: jsonb("scope").notNull().default("{}"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const consentRecords = pgTable("consent_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  method: text("method").notNull(),
  acknowledgedBy: uuid("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note")
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata").notNull().default("{}"),
  ip: inet("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const usageMeters = pgTable("usage_meters", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  asrSeconds: bigint("asr_seconds", { mode: 'number' }).notNull().default(0),
  llmTokensIn: bigint("llm_tokens_in", { mode: 'number' }).notNull().default(0),
  llmTokensOut: bigint("llm_tokens_out", { mode: 'number' }).notNull().default(0),
  costEstimate: numeric("cost_estimate").notNull().default("0"),
  budgetCap: numeric("budget_cap")
});

export const providerConfigs = pgTable("provider_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  kind: text("kind").notNull(),
  provider: text("provider").notNull(),
  baseUrl: text("base_url"),
  apiKeyEnc: text("api_key_enc"),
  model: text("model"),
  options: jsonb("options").notNull().default("{}"),
  isDefault: boolean("is_default").notNull().default(false),
  status: text("status").notNull().default("unconfigured"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const storageObjects = pgTable("storage_objects", {
  key: text("key").primaryKey(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id"),
  kind: text("kind").notNull(),
  sizeBytes: bigint("size_bytes", { mode: 'number' }),
  contentType: text("content_type"),
  encryption: text("encryption").notNull().default("sse-s3"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const publicShares = pgTable("public_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  access: text("access").notNull().default("link"),
  passwordHash: text("password_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull().default("{}"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

