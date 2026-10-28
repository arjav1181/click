export type MeetingStatus =
  | "scheduled"
  | "joining"
  | "live"
  | "processing"
  | "ready"
  | "failed";

export type MeetingSource = "bot" | "desktop" | "extension" | "mobile" | "web" | "upload" | "api";

export interface Meeting {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  source: MeetingSource;
  status: MeetingStatus;
  language: string | null;
  ownerId: string;
  ownerName: string;
  participantCount: number;
  privacy: "private" | "workspace" | "link";
  folderId: string | null;
  folderName: string | null;
  channelId: string | null;
  hasTranscript: boolean;
  hasSummary: boolean;
  audioAvailable: boolean;
  consentMethod: string | null;
  tags: string[];
}

export interface TranscriptSegment {
  id: string;
  meetingId: string;
  index: number;
  speakerId: string;
  speakerName: string | null;
  speakerIsMe: boolean;
  startMs: number;
  endMs: number;
  text: string;
  edited: boolean;
  confidence: number;
  flags: string[];
}

export interface Citation {
  id: string;
  segmentId: string;
  startMs: number;
  quote: string;
  origin: "human" | "ai";
  label: string;
}

export interface NoteSection {
  id: string;
  key: string;
  title: string;
  body: string;
  orderIndex: number;
  source: "template" | "ai" | "custom";
}

export interface Note {
  id: string;
  meetingId: string;
  rawMarkdown: string;
  enhancedStatus: "none" | "generating" | "ready" | "failed" | "stale";
  sections: NoteSection[];
  citations: Citation[];
  templateId: string | null;
  model: string | null;
  generatedAt: string | null;
  version: number;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  meetingTitle: string;
  text: string;
  assigneeName: string | null;
  dueAt: string | null;
  status: "open" | "done" | "pushed" | "failed";
  sourceSegmentId: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetingUrl: string | null;
  autoJoin: boolean;
  botStatus: "none" | "scheduled" | "joining" | "joined" | "declined";
  cancelled: boolean;
  provider: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  space: "personal" | "team" | "shared";
  meetingCount: number;
}

export interface Channel {
  id: string;
  name: string;
  visibility: "public" | "private";
  archived: boolean;
  meetingCount: number;
}

export interface SearchResult {
  id: string;
  meetingId: string;
  meetingTitle: string;
  segmentId: string;
  speakerName: string | null;
  startMs: number;
  snippet: string;
  score: number;
  kind: "segment" | "note" | "meeting";
}

export interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  asrSeconds: number;
  llmTokensIn: number;
  llmTokensOut: number;
  costEstimate: number;
  budgetCap: number;
  currency: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  scope: "builtin" | "personal" | "group" | "workspace";
  sections: { key: string; title: string }[];
}

export interface Recipe {
  id: string;
  name: string;
  prompt: string;
  scope: "single" | "multi";
  visibility: "private" | "workspace";
  model: string | null;
  runs: number;
}

export interface Skill {
  id: string;
  name: string;
  trigger: "manual" | "per_meeting" | "daily" | "weekly" | "monthly";
  enabled: boolean;
  lastRunAt: string | null;
  outputTarget: string;
}

export interface Person {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  companyId: string | null;
  meetingCount: number;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  meetingCount: number;
}

export interface Integration {
  key: string;
  name: string;
  category: string;
  status: "connected" | "available" | "error" | "needs_reauth";
  description: string;
}

export interface AuditEvent {
  id: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  ip: string;
}

export interface NotificationPreferences {
  digest: boolean;
  mentions: boolean;
  followUps: boolean;
  meetingReminders: boolean;
  quietHours: string | null;
}

export interface VocabularyTerm {
  id: string;
  term: string;
  kind: "name" | "jargon";
  scope: "personal" | "workspace";
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited" | "deactivated";
  lastSeenAt: string | null;
}

export interface LegalHold {
  id: string;
  name: string;
  custodians: string[];
  scope: string;
  createdAt: string;
  releasedAt: string | null;
}
