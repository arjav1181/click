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
