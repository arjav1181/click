import { data } from "@click/core";
import type {
  ActionItem,
  Meeting,
  Note,
  SearchResult,
  TranscriptSegment,
  UsageSummary,
} from "@click/core";

/**
 * Thin client for the Click API.
 *
 * Every call falls back to the bundled demo data when the API is unreachable
 * or the session is missing, so the UI stays usable in a fresh checkout. When
 * the API answers, the real workspace is shown.
 */

async function request<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) return null;
    if (response.status === 204) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface ApiMeeting {
  id: string;
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  source: string;
  status: string;
  language: string | null;
  privacy: string;
  ownerId: string;
  ownerName: string;
  participantCount: number;
  folderName: string | null;
  hasTranscript: boolean;
  hasSummary: boolean;
  audioAvailable: boolean;
}

function toMeeting(row: ApiMeeting): Meeting {
  return {
    id: row.id,
    title: row.title,
    startedAt: row.startedAt ?? new Date().toISOString(),
    endedAt: row.endedAt,
    durationSeconds: row.durationSeconds,
    source: row.source as Meeting["source"],
    status: row.status as Meeting["status"],
    language: row.language,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    participantCount: row.participantCount,
    privacy: row.privacy as Meeting["privacy"],
    folderId: null,
    folderName: row.folderName,
    channelId: null,
    hasTranscript: row.hasTranscript,
    hasSummary: row.hasSummary,
    audioAvailable: row.audioAvailable,
    consentMethod: null,
    tags: [],
  };
}

export async function listMeetings(filters: {
  q?: string;
  status?: string;
  folderId?: string;
  limit?: number;
} = {}): Promise<{ meetings: Meeting[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.folderId) params.set("folderId", filters.folderId);
  if (filters.limit) params.set("limit", String(filters.limit));
  const payload = await request<{ meetings: ApiMeeting[]; total: number }>(
    `/api/v1/meetings?${params.toString()}`,
  );
  if (!payload) return data.listMeetings(filters as never);
  return { meetings: payload.meetings.map(toMeeting), total: payload.total };
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const payload = await request<{ meeting: ApiMeeting }>(`/api/v1/meetings/${id}`);
  if (!payload) return (await data.getMeeting(id)) ?? null;
  return toMeeting(payload.meeting);
}

interface ApiSegment {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  edited: boolean;
  confidence: number | null;
  speakerId: string | null;
  speakerName: string | null;
  speakerIsMe: boolean;
}

export async function listTranscriptSegments(meetingId: string): Promise<TranscriptSegment[]> {
  const payload = await request<{ segments: ApiSegment[] }>(`/api/v1/meetings/${meetingId}/transcript`);
  if (!payload) return data.listTranscriptSegments(meetingId);
  return payload.segments.map((segment) => ({
    id: segment.id,
    meetingId,
    index: segment.index,
    speakerId: segment.speakerId ?? "",
    speakerName: segment.speakerName,
    speakerIsMe: segment.speakerIsMe,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: segment.text,
    edited: segment.edited,
    confidence: segment.confidence ?? 1,
    flags: [],
  }));
}

interface ApiNote {
  id: string;
  meetingId: string;
  rawMarkdown: string;
  enhancedStatus: string;
  templateId: string | null;
  model: string | null;
  generatedAt: string | null;
  version: number;
  sections: Array<{
    id: string;
    key: string;
    title: string;
    body: string;
    orderIndex: number;
    source: string;
  }>;
  citations: Array<{
    id: string;
    segmentId: string | null;
    startMs: number | null;
    quote: string;
    origin: string;
    label: string | null;
  }>;
}

function toNote(row: ApiNote): Note {
  return {
    id: row.id,
    meetingId: row.meetingId,
    rawMarkdown: row.rawMarkdown,
    enhancedStatus: row.enhancedStatus as Note["enhancedStatus"],
    templateId: row.templateId,
    model: row.model,
    generatedAt: row.generatedAt,
    version: row.version,
    sections: row.sections.map((section) => ({
      id: section.id,
      key: section.key,
      title: section.title,
      body: section.body,
      orderIndex: section.orderIndex,
      source: section.source as Note["sections"][number]["source"],
    })),
    citations: row.citations.map((citation) => ({
      id: citation.id,
      segmentId: citation.segmentId ?? "",
      startMs: citation.startMs ?? 0,
      quote: citation.quote,
      origin: citation.origin as "human" | "ai",
      label: citation.label ?? "",
    })),
  };
}

export async function getNote(meetingId: string): Promise<Note | null> {
  const payload = await request<{ note: ApiNote | null }>(`/api/v1/meetings/${meetingId}/notes`);
  if (!payload) return (await data.getNote(meetingId)) ?? null;
  return payload.note ? toNote(payload.note) : null;
}

export async function saveNote(meetingId: string, rawMarkdown: string): Promise<Note | null> {
  const payload = await request<{ note: ApiNote | null }>(`/api/v1/meetings/${meetingId}/notes`, {
    method: "PUT",
    body: JSON.stringify({ rawMarkdown }),
  });
  if (!payload) return (await data.saveNote(meetingId, rawMarkdown)) ?? null;
  return payload.note ? toNote(payload.note) : null;
}

export async function generateNote(meetingId: string, templateId?: string): Promise<Note | null> {
  const payload = await request<{ noteId: string }>(`/api/v1/meetings/${meetingId}/notes/generate`, {
    method: "POST",
    body: JSON.stringify({ templateId: templateId ?? null }),
  });
  if (!payload) return (await data.generateNote(meetingId, templateId ?? "t_default")) ?? null;
  return getNote(meetingId);
}

export async function listActionItems(): Promise<ActionItem[]> {
  const payload = await request<{
    items: Array<{
      id: string;
      meetingId: string;
      meetingTitle: string;
      text: string;
      assigneeName: string | null;
      dueAt: string | null;
      status: string;
      sourceSegmentId: string | null;
    }>;
  }>("/api/v1/action-items");
  if (!payload) return data.listActionItems();
  return payload.items.map((item) => ({
    id: item.id,
    meetingId: item.meetingId,
    meetingTitle: item.meetingTitle,
    text: item.text,
    assigneeName: item.assigneeName,
    dueAt: item.dueAt,
    status: item.status === "done" ? "done" : "open",
    sourceSegmentId: item.sourceSegmentId,
  }));
}

/**
 * Strict variant of `request` used by the workspace screens: it reports the
 * failure instead of silently falling back to demo data, so a screen can show
 * an error state and a "no permission" state.
 */
export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as T & {
      error?: { message?: string };
    };
    if (!response.ok) {
      return {
        data: null,
        error: payload.error?.message ?? "That did not work. Try again.",
        status: response.status,
      };
    }
    return { data: payload, error: null, status: response.status };
  } catch {
    return {
      data: null,
      error: "We could not reach the server. Check your connection and try again.",
      status: 0,
    };
  }
}

export interface ActionItemRow {
  id: string;
  meetingId: string;
  meetingTitle: string;
  text: string;
  assigneeName: string | null;
  dueAt: string | null;
  status: string;
  sourceSegmentId: string | null;
}

export async function fetchActionItems(): Promise<ApiResult<{ items: ActionItemRow[] }>> {
  return apiFetch<{ items: ActionItemRow[] }>("/api/v1/action-items");
}

export async function patchActionItem(
  id: string,
  patch: { status?: "open" | "done" | "cancelled"; assigneeName?: string | null; dueAt?: string | null },
): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/action-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface FolderRow {
  id: string;
  name: string;
  parentId: string | null;
  spaceId: string | null;
  icon: string | null;
  description: string | null;
  linkAccess: string;
  ownerId: string;
  meetingCount: number;
}

export interface SpaceRow {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  kind: "personal" | "team" | "custom";
  folderCount: number;
}

export async function fetchFolders(): Promise<ApiResult<{ folders: FolderRow[] }>> {
  return apiFetch<{ folders: FolderRow[] }>("/api/v1/folders");
}

export async function fetchSpaces(): Promise<ApiResult<{ spaces: SpaceRow[] }>> {
  return apiFetch<{ spaces: SpaceRow[] }>("/api/v1/spaces");
}

export async function createFolder(input: {
  name: string;
  parentId?: string | null;
  spaceId?: string | null;
  description?: string | null;
}): Promise<ApiResult<{ folder: { id: string; name: string } }>> {
  return apiFetch<{ folder: { id: string; name: string } }>("/api/v1/folders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createSpace(input: {
  name: string;
  kind: "personal" | "team" | "custom";
  description?: string | null;
}): Promise<ApiResult<{ space: { id: string; name: string } }>> {
  return apiFetch<{ space: { id: string; name: string } }>("/api/v1/spaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchMeetingsInFolder(
  folderId: string,
): Promise<ApiResult<{ meetings: ApiMeeting[]; total: number }>> {
  return apiFetch<{ meetings: ApiMeeting[]; total: number }>(
    `/api/v1/meetings?folderId=${encodeURIComponent(folderId)}`,
  );
}

export async function moveMeetingToFolder(
  meetingId: string,
  folderId: string | null,
): Promise<ApiResult<{ meeting: ApiMeeting }>> {
  return apiFetch<{ meeting: ApiMeeting }>(`/api/v1/meetings/${meetingId}`, {
    method: "PATCH",
    body: JSON.stringify({ folderId }),
  });
}

export interface ChannelRow {
  id: string;
  name: string;
  visibility: "public" | "private";
  description: string | null;
  archivedAt: string | null;
  memberCount: number;
  meetingCount: number;
}

export interface ChannelMemberRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
}

export async function fetchChannels(): Promise<ApiResult<{ channels: ChannelRow[] }>> {
  return apiFetch<{ channels: ChannelRow[] }>("/api/v1/channels");
}

export async function fetchChannel(
  id: string,
): Promise<ApiResult<{ channel: ChannelRow | null; members: ChannelMemberRow[] }>> {
  return apiFetch<{ channel: ChannelRow | null; members: ChannelMemberRow[] }>(
    `/api/v1/channels/${id}`,
  );
}

export async function createChannel(input: {
  name: string;
  visibility: "public" | "private";
  description?: string | null;
}): Promise<ApiResult<{ channel: { id: string; name: string } }>> {
  return apiFetch<{ channel: { id: string; name: string } }>("/api/v1/channels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function patchChannel(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    visibility?: "public" | "private";
    archived?: boolean;
  },
): Promise<ApiResult<{ channel: ChannelRow | null }>> {
  return apiFetch<{ channel: ChannelRow | null }>(`/api/v1/channels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function fetchMeetingsInChannel(
  channelId: string,
): Promise<ApiResult<{ meetings: ApiMeeting[]; total: number }>> {
  return apiFetch<{ meetings: ApiMeeting[]; total: number }>(
    `/api/v1/meetings?channelId=${encodeURIComponent(channelId)}`,
  );
}

export interface WorkspaceMemberRow {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited" | "deactivated";
  lastSeenAt: string | null;
}

export async function fetchMembers(): Promise<ApiResult<{ members: WorkspaceMemberRow[] }>> {
  return apiFetch<{ members: WorkspaceMemberRow[] }>("/api/v1/org/members");
}

export async function updateMember(
  id: string,
  patch: {
    role?: "owner" | "admin" | "member";
    status?: "active" | "invited" | "deactivated";
  },
): Promise<ApiResult<{ member: WorkspaceMemberRow | null }>> {
  return apiFetch<{ member: WorkspaceMemberRow | null }>(`/api/v1/org/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function inviteMember(input: {
  email: string;
  role: "owner" | "admin" | "member";
}): Promise<ApiResult<{ ok: boolean; devLink?: string }>> {
  return apiFetch<{ ok: boolean; devLink?: string }>("/api/v1/org/invites", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AuditEventRow {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  ip: string | null;
  actorId: string | null;
  actorName: string | null;
}

export interface AuditFilters {
  action?: string;
  actorId?: string;
  targetType?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAuditEvents(
  filters: AuditFilters = {},
): Promise<ApiResult<{ events: AuditEventRow[]; actions: string[] }>> {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.since) params.set("since", filters.since);
  if (filters.until) params.set("until", filters.until);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  const query = params.toString();
  return apiFetch<{ events: AuditEventRow[]; actions: string[] }>(
    `/api/v1/org/audit${query ? `?${query}` : ""}`,
  );
}

export interface ProfileDto {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    locale: string;
    timezone: string;
    emailVerified: boolean;
  };
  org: { id: string; name: string; slug: string; role: string } | null;
}

export async function fetchProfile(): Promise<ApiResult<ProfileDto>> {
  return apiFetch<ProfileDto>("/api/v1/settings/profile");
}

export async function updateProfile(patch: {
  name?: string;
  locale?: string;
  timezone?: string;
  avatarUrl?: string | null;
}): Promise<ApiResult<ProfileDto>> {
  return apiFetch<ProfileDto>("/api/v1/settings/profile", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface WorkspaceDefaults {
  autoSummarize: boolean;
  defaultLanguage: string;
  defaultPrivacy: "private" | "workspace";
}

export interface WorkspaceOrg {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  domainAllowlist: string[];
  createdAt: string;
}

export interface WorkspaceDto {
  org: WorkspaceOrg | null;
  defaults: WorkspaceDefaults;
  role: "owner" | "admin" | "member";
  counts: { members: number; active: number };
}

export async function fetchOrg(): Promise<ApiResult<WorkspaceDto>> {
  return apiFetch<WorkspaceDto>("/api/v1/org");
}

export async function updateOrg(patch: {
  name?: string;
  logoUrl?: string | null;
}): Promise<ApiResult<{ org: WorkspaceOrg | null }>> {
  return apiFetch<{ org: WorkspaceOrg | null }>("/api/v1/org", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function updateOrgDefaults(
  patch: Partial<WorkspaceDefaults>,
): Promise<ApiResult<{ defaults: WorkspaceDefaults }>> {
  return apiFetch<{ defaults: WorkspaceDefaults }>("/api/v1/org", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function addOrgDomain(
  domain: string,
): Promise<ApiResult<{ domainAllowlist: string[] }>> {
  return apiFetch<{ domainAllowlist: string[] }>("/api/v1/org/domains", {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

export async function removeOrgDomain(
  domain: string,
): Promise<ApiResult<{ domainAllowlist: string[] }>> {
  return apiFetch<{ domainAllowlist: string[] }>(
    `/api/v1/org/domains?domain=${encodeURIComponent(domain)}`,
    { method: "DELETE" },
  );
}

export async function transferOrgOwnership(
  userId: string,
): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>("/api/v1/org/ownership", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function deleteOrg(
  confirmName: string,
): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>("/api/v1/org", {
    method: "DELETE",
    body: JSON.stringify({ confirmName }),
  });
}

export const EXPORT_FORMATS = [
  "md",
  "txt",
  "pdf",
  "docx",
  "srt",
  "vtt",
  "json",
  "mp3",
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportDownload {
  blob: Blob;
  filename: string;
  exported: number;
  skipped: number;
}

async function downloadFrom(
  url: string,
  init: RequestInit | undefined,
  fallbackName: string,
): Promise<{ data: ExportDownload | null; error: string | null }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return { data: null, error: payload.error?.message ?? "That export did not work. Try again." };
    }
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    return {
      data: {
        blob: await response.blob(),
        filename: match?.[1] ?? fallbackName,
        exported: Number(response.headers.get("X-Exported-Count") ?? 1),
        skipped: Number(response.headers.get("X-Skipped-Count") ?? 0),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "We could not reach the server. Check your connection and try again." };
  }
}

/** Downloads one meeting in the chosen format. */
export async function exportMeeting(
  meetingId: string,
  format: ExportFormat,
): Promise<{ data: ExportDownload | null; error: string | null }> {
  return downloadFrom(
    `/api/v1/meetings/${meetingId}/export?format=${encodeURIComponent(format)}`,
    undefined,
    `meeting.${format}`,
  );
}

/** Downloads a zip archive with one file per selected meeting. */
export async function exportMeetings(
  meetingIds: string[],
  format: ExportFormat,
): Promise<{ data: ExportDownload | null; error: string | null }> {
  return downloadFrom(
    "/api/v1/export",
    { method: "POST", body: JSON.stringify({ meetingIds, format }) },
    `click-export-${format}.zip`,
  );
}

export interface TemplateSection {
  key: string;
  title: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  description: string;
  prompt: string;
  sections: TemplateSection[];
  scope: string;
  isBuiltin: boolean;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: string;
}

export async function fetchTemplates(): Promise<ApiResult<{ templates: TemplateRow[] }>> {
  return apiFetch<{ templates: TemplateRow[] }>("/api/v1/templates");
}

export async function createTemplate(input: {
  name: string;
  description?: string;
  prompt?: string;
  sections?: TemplateSection[];
  scope: "personal" | "workspace";
}): Promise<ApiResult<{ template: TemplateRow }>> {
  return apiFetch<{ template: TemplateRow }>("/api/v1/templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTemplate(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    prompt?: string | null;
    sections?: TemplateSection[];
    scope?: "personal" | "workspace";
  },
): Promise<ApiResult<{ template: TemplateRow | null }>> {
  return apiFetch<{ template: TemplateRow | null }>(`/api/v1/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteTemplate(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/templates/${id}`, { method: "DELETE" });
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdByName: string;
}

export async function fetchApiKeys(): Promise<
  ApiResult<{ keys: ApiKeyRow[]; scopes: string[] }>
> {
  return apiFetch<{ keys: ApiKeyRow[]; scopes: string[] }>("/api/v1/api-keys");
}

export async function createApiKey(input: {
  name: string;
  scopes: string[];
}): Promise<ApiResult<{ id: string; prefix: string; rawKey: string }>> {
  return apiFetch<{ id: string; prefix: string; rawKey: string }>("/api/v1/api-keys", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function revokeApiKey(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/api-keys/${id}`, { method: "DELETE" });
}

export interface WebhookEndpointRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface WebhookDeliveryRow {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  createdAt: string;
}

export async function fetchWebhooks(): Promise<
  ApiResult<{ endpoints: WebhookEndpointRow[]; events: string[] }>
> {
  return apiFetch<{ endpoints: WebhookEndpointRow[]; events: string[] }>("/api/v1/webhooks");
}

export async function createWebhook(input: {
  url: string;
  events: string[];
}): Promise<ApiResult<{ id: string; secret: string }>> {
  return apiFetch<{ id: string; secret: string }>("/api/v1/webhooks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateWebhook(
  id: string,
  patch: { url?: string; events?: string[]; active?: boolean },
): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteWebhook(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/webhooks/${id}`, { method: "DELETE" });
}

export async function fetchWebhookDeliveries(
  id: string,
): Promise<ApiResult<{ deliveries: WebhookDeliveryRow[] }>> {
  return apiFetch<{ deliveries: WebhookDeliveryRow[] }>(`/api/v1/webhooks/${id}/deliveries`);
}

export interface IntegrationCatalogRow {
  key: string;
  name: string;
  category: string;
  authKind: string;
  scopes: string[];
  docsUrl: string | null;
}

export interface IntegrationConnectionRow {
  id: string;
  integrationKey: string;
  status: "connected" | "error" | "revoked";
  config: Record<string, unknown>;
  connectedAt: string;
  connectedByName: string | null;
}

export async function fetchIntegrations(): Promise<
  ApiResult<{ catalog: IntegrationCatalogRow[]; connections: IntegrationConnectionRow[] }>
> {
  return apiFetch<{ catalog: IntegrationCatalogRow[]; connections: IntegrationConnectionRow[] }>(
    "/api/v1/integrations",
  );
}

export async function connectIntegration(input: {
  integrationKey: string;
  config?: Record<string, unknown>;
}): Promise<ApiResult<{ id: string }>> {
  return apiFetch<{ id: string }>("/api/v1/integrations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function disconnectIntegration(key: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/integrations/${key}`, { method: "DELETE" });
}

export interface ChatThreadRow {
  id: string;
  title: string | null;
  scope: string;
  scopeIds: string[];
  mode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatCitation {
  meetingId: string;
  segmentId: string | null;
  quote: string;
  label: string;
}

export interface ChatMessageRow {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  citations: ChatCitation[];
  createdAt: string;
}

export async function fetchChatThreads(): Promise<ApiResult<{ threads: ChatThreadRow[] }>> {
  return apiFetch<{ threads: ChatThreadRow[] }>("/api/v1/chat/threads");
}

export async function createChatThread(input: {
  title?: string;
  scope?: string;
  scopeIds?: string[];
  mode?: "chat" | "work";
}): Promise<ApiResult<{ thread: ChatThreadRow }>> {
  return apiFetch<{ thread: ChatThreadRow }>("/api/v1/chat/threads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchChatThread(
  id: string,
): Promise<ApiResult<{ thread: ChatThreadRow; messages: ChatMessageRow[] }>> {
  return apiFetch<{ thread: ChatThreadRow; messages: ChatMessageRow[] }>(`/api/v1/chat/threads/${id}`);
}

export async function deleteChatThread(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/chat/threads/${id}`, { method: "DELETE" });
}

export async function askChat(
  threadId: string,
  content: string,
): Promise<ApiResult<{ message: ChatMessageRow; citations: ChatCitation[] }>> {
  return apiFetch<{ message: ChatMessageRow; citations: ChatCitation[] }>(
    `/api/v1/chat/threads/${threadId}/messages`,
    { method: "POST", body: JSON.stringify({ content }) },
  );
}

export interface PublicShareRow {
  id: string;
  meetingId: string;
  access: "link" | "domain" | "password";
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export async function fetchShares(meetingId: string): Promise<ApiResult<{ shares: PublicShareRow[] }>> {
  return apiFetch<{ shares: PublicShareRow[] }>(`/api/v1/meetings/${meetingId}/shares`);
}

export async function createShare(
  meetingId: string,
  input: { access: "link" | "domain" | "password"; password?: string; expiresAt?: string },
): Promise<ApiResult<{ share: { id: string }; link: string; token: string }>> {
  return apiFetch<{ share: { id: string }; link: string; token: string }>(
    `/api/v1/meetings/${meetingId}/shares`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function revokeShare(meetingId: string, shareId: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/meetings/${meetingId}/shares/${shareId}`, { method: "DELETE" });
}

export interface PublicRecap {
  meeting: { id: string; title: string; startedAt: string | null; durationSeconds: number; ownerName: string };
  note: { rawMarkdown: string | null; sections: Array<{ id: string; title: string; body: string }> } | null;
  transcript: Array<{ id: string; startMs: number; endMs: number; text: string; speakerName: string | null }>;
}

export async function fetchPublicRecap(
  token: string,
  password?: string,
): Promise<ApiResult<PublicRecap>> {
  const url = `/api/v1/public/shares/${token}${password ? `?password=${encodeURIComponent(password)}` : ""}`;
  return apiFetch<PublicRecap>(url);
}

export interface SpeakerRow {
  id: string;
  name: string | null;
  email: string | null;
  isMe: boolean;
  mergedIntoId: string | null;
  meetingCount: number;
  segmentCount: number;
}

export async function fetchSpeakers(): Promise<ApiResult<{ speakers: SpeakerRow[] }>> {
  return apiFetch<{ speakers: SpeakerRow[] }>("/api/v1/speakers");
}

export async function renameSpeaker(id: string, name: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/speakers/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function mergeSpeakers(sourceId: string, targetId: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>("/api/v1/speakers/merge", {
    method: "POST",
    body: JSON.stringify({ sourceId, targetId }),
  });
}

export interface VocabularyTermRow {
  id: string;
  term: string;
  kind: "name" | "term" | "acronym";
  scope: "personal" | "workspace";
  createdByName: string | null;
  createdAt: string;
}

export async function fetchVocabulary(): Promise<ApiResult<{ terms: VocabularyTermRow[] }>> {
  return apiFetch<{ terms: VocabularyTermRow[] }>("/api/v1/vocabulary");
}

export async function addVocabularyTerm(input: {
  term: string;
  kind: "name" | "term" | "acronym";
  scope: "personal" | "workspace";
}): Promise<ApiResult<{ id: string } | { ok: false; reason: "duplicate" }>> {
  return apiFetch<{ id: string } | { ok: false; reason: "duplicate" }>("/api/v1/vocabulary", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteVocabularyTerm(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/vocabulary/${id}`, { method: "DELETE" });
}

export interface LegalHoldRow {
  id: string;
  name: string;
  description: string | null;
  custodianIds: string[];
  custodianNames: string[];
  scope: Record<string, unknown>;
  releasedAt: string | null;
  createdAt: string;
}

export async function fetchLegalHolds(): Promise<ApiResult<{ holds: LegalHoldRow[] }>> {
  return apiFetch<{ holds: LegalHoldRow[] }>("/api/v1/legal-hold");
}

export async function createLegalHold(input: {
  name: string;
  description?: string;
  custodianIds?: string[];
}): Promise<ApiResult<{ id: string }>> {
  return apiFetch<{ id: string }>("/api/v1/legal-hold", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function releaseLegalHold(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/legal-hold/${id}/release`, { method: "POST" });
}

export async function deleteLegalHold(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>(`/api/v1/legal-hold/${id}`, { method: "DELETE" });
}

export interface RecordingPolicy {
  autoJoinDefault: boolean;
  botName: string;
  consentNotice: string;
  privateByDefault: boolean;
}

export async function fetchRecordingPolicy(): Promise<ApiResult<{ policy: RecordingPolicy }>> {
  return apiFetch<{ policy: RecordingPolicy }>("/api/v1/admin/recording");
}

export async function updateRecordingPolicy(
  patch: Partial<RecordingPolicy>,
): Promise<ApiResult<{ policy: RecordingPolicy }>> {
  return apiFetch<{ policy: RecordingPolicy }>("/api/v1/admin/recording", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export interface RetentionPolicy {
  transcriptDays: number | null;
  audioDays: number | null;
  recordingMode: "audio" | "audio_video" | "transcript_only";
  legalHoldOverride: boolean;
  updatedAt: string | null;
}

export async function fetchRetention(): Promise<ApiResult<{ policy: RetentionPolicy }>> {
  return apiFetch<{ policy: RetentionPolicy }>("/api/v1/retention");
}

export async function updateRetention(
  patch: Partial<Omit<RetentionPolicy, "updatedAt">>,
): Promise<ApiResult<{ policy: RetentionPolicy }>> {
  return apiFetch<{ policy: RetentionPolicy }>("/api/v1/retention", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export interface AiFeatureGates {
  summaries: boolean;
  actionItems: boolean;
  semanticSearch: boolean;
  transcription: boolean;
}

export interface AiModelDefaults {
  asr: string | null;
  llm: string | null;
  embeddings: string | null;
}

export interface AiPolicy {
  budgetCap: number;
  featureGates: AiFeatureGates;
  modelDefaults: AiModelDefaults;
}

export interface ProviderConfigRow {
  id: string;
  kind: string;
  provider: string;
  baseUrl: string | null;
  model: string | null;
  options: Record<string, unknown>;
  isDefault: boolean;
  status: string;
  hasKey: boolean;
  updatedAt: string;
}

export interface AiUsage {
  periodStart: string | null;
  periodEnd: string | null;
  asrSeconds: number;
  llmTokensIn: number;
  llmTokensOut: number;
  costEstimate: number;
  budgetCap: number;
  currency: string;
}

export async function fetchAiPolicy(): Promise<
  ApiResult<{ policy: AiPolicy; providers: ProviderConfigRow[]; usage: AiUsage }>
> {
  return apiFetch<{ policy: AiPolicy; providers: ProviderConfigRow[]; usage: AiUsage }>(
    "/api/v1/admin/ai-policy",
  );
}

export async function updateAiPolicy(patch: {
  budgetCap?: number;
  featureGates?: Partial<AiFeatureGates>;
  modelDefaults?: Partial<AiModelDefaults>;
}): Promise<ApiResult<{ policy: AiPolicy }>> {
  return apiFetch<{ policy: AiPolicy }>("/api/v1/admin/ai-policy", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function saveProviderConfig(input: {
  kind: "asr" | "llm" | "embedding";
  provider: string;
  baseUrl?: string | null;
  apiKey?: string;
  model?: string | null;
  enabled?: boolean;
}): Promise<ApiResult<{ providers: ProviderConfigRow[]; saved: string | null }>> {
  return apiFetch<{ providers: ProviderConfigRow[]; saved: string | null }>(
    "/api/v1/admin/ai-policy/providers",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteProviderConfig(
  id: string,
): Promise<ApiResult<{ providers: ProviderConfigRow[] }>> {
  return apiFetch<{ providers: ProviderConfigRow[] }>(
    `/api/v1/admin/ai-policy/providers/${id}`,
    { method: "DELETE" },
  );
}

export async function searchMeetings(query: string): Promise<SearchResult[]> {
  const payload = await request<{ results: SearchResult[] }>(
    `/api/v1/search?q=${encodeURIComponent(query)}`,
  );
  if (!payload) return data.searchMeetings(query);
  return payload.results.map((hit) => ({
    ...hit,
    segmentId: hit.segmentId ?? "",
    speakerName: hit.speakerName ?? null,
  }));
}

export async function getUsage(): Promise<UsageSummary> {
  const payload = await request<{ usage: UsageSummary }>("/api/v1/org/usage");
  if (!payload) return data.getUsage();
  return payload.usage;
}

export async function fetchUsage(): Promise<ApiResult<{ usage: UsageSummary }>> {
  return apiFetch<{ usage: UsageSummary }>("/api/v1/org/usage");
}

export async function uploadRecording(input: {
  name: string;
  size: number;
  title?: string;
  file?: File;
}): Promise<Meeting> {
  if (input.file) {
    const form = new FormData();
    form.append("file", input.file);
    if (input.title) form.append("title", input.title);
    const payload = await request<{ meeting: ApiMeeting }>("/api/v1/uploads", {
      method: "POST",
      body: form,
    });
    if (payload) return toMeeting(payload.meeting);
  }
  return (await data.uploadRecording({ name: input.name, size: input.size })) as Meeting;
}
