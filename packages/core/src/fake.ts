import { SEED_MEETINGS, SEED_SEGMENTS, SEED_NOTES, SEED_ACTION_ITEMS, SEED_EVENTS, SEED_FOLDERS, SEED_CHANNELS, SEED_TEMPLATES, SEED_RECIPES, SEED_SKILLS, SEED_PEOPLE, SEED_COMPANIES, SEED_INTEGRATIONS, SEED_MEMBERS, SEED_AUDIT, SEED_LEGAL_HOLDS, SEED_VOCAB, SEED_USAGE } from "./seed";
import type {
  Meeting,
  TranscriptSegment,
  Note,
  ActionItem,
  CalendarEvent,
  Folder,
  Channel,
  Template,
  Recipe,
  Skill,
  Person,
  Company,
  Integration,
  AuditEvent,
  WorkspaceMember,
  LegalHold,
  VocabularyTerm,
  UsageSummary,
  SearchResult,
  MeetingStatus,
} from "./types";

// In-memory mutable store (fake backend). A real backend swaps this module for
// repository calls that open a transaction with RLS settings; screen code does
// not change because the signatures stay identical.
const meetings: Meeting[] = [...SEED_MEETINGS];
const segments: Record<string, TranscriptSegment[]> = JSON.parse(JSON.stringify(SEED_SEGMENTS));
const notes: Record<string, Note> = JSON.parse(JSON.stringify(SEED_NOTES));
const actionItems: ActionItem[] = [...SEED_ACTION_ITEMS];
const events: CalendarEvent[] = [...SEED_EVENTS];
const folders: Folder[] = [...SEED_FOLDERS];
const channels: Channel[] = [...SEED_CHANNELS];
const templates: Template[] = [...SEED_TEMPLATES];
const recipes: Recipe[] = [...SEED_RECIPES];
const skills: Skill[] = [...SEED_SKILLS];
const people: Person[] = [...SEED_PEOPLE];
const companies: Company[] = [...SEED_COMPANIES];
const integrations: Integration[] = [...SEED_INTEGRATIONS];
const members: WorkspaceMember[] = [...SEED_MEMBERS];
const auditEvents: AuditEvent[] = [...SEED_AUDIT];
const legalHolds: LegalHold[] = [...SEED_LEGAL_HOLDS];
const vocabulary: VocabularyTerm[] = [...SEED_VOCAB];

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export const data = {
  async listMeetings(filters?: {
    q?: string;
    status?: MeetingStatus;
    folderId?: string;
    channelId?: string;
    source?: Meeting["source"];
    limit?: number;
  }): Promise<{ meetings: Meeting[]; total: number }> {
    await delay();
    let rows = [...meetings];
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter((m) => m.title.toLowerCase().includes(q));
    }
    if (filters?.status) rows = rows.filter((m) => m.status === filters.status);
    if (filters?.folderId) rows = rows.filter((m) => m.folderId === filters.folderId);
    if (filters?.channelId) rows = rows.filter((m) => m.channelId === filters.channelId);
    if (filters?.source) rows = rows.filter((m) => m.source === filters.source);
    rows.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const limit = filters?.limit ?? rows.length;
    return { meetings: rows.slice(0, limit), total: rows.length };
  },

  async getMeeting(id: string): Promise<Meeting | null> {
    await delay();
    return meetings.find((m) => m.id === id) ?? null;
  },

  async listTranscriptSegments(meetingId: string): Promise<TranscriptSegment[]> {
    await delay();
    return [...(segments[meetingId] ?? [])];
  },

  async getNote(meetingId: string): Promise<Note | null> {
    await delay();
    return notes[meetingId] ?? null;
  },

  async saveNote(meetingId: string, rawMarkdown: string): Promise<Note> {
    await delay();
    const existing = notes[meetingId];
    if (existing) {
      existing.rawMarkdown = rawMarkdown;
      existing.version += 1;
      return existing;
    }
    const created: Note = {
      id: `n_${meetingId}`,
      meetingId,
      rawMarkdown,
      enhancedStatus: "none",
      sections: [],
      citations: [],
      templateId: null,
      model: null,
      generatedAt: null,
      version: 1,
    };
    notes[meetingId] = created;
    return created;
  },

  async generateNote(meetingId: string, templateId: string | null): Promise<Note> {
    await delay(600);
    const existing = notes[meetingId];
    if (existing) {
      existing.enhancedStatus = "generating";
      await delay(400);
      existing.enhancedStatus = "ready";
      existing.generatedAt = new Date().toISOString();
      existing.version += 1;
      return existing;
    }
    const created = await this.saveNote(meetingId, "");
    created.enhancedStatus = "ready";
    created.generatedAt = new Date().toISOString();
    created.templateId = templateId;
    return created;
  },

  async searchMeetings(query: string, filters?: { speaker?: string; from?: string; to?: string }): Promise<SearchResult[]> {
    await delay();
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const results: SearchResult[] = [];
    for (const meeting of meetings) {
      const segs = segments[meeting.id] ?? [];
      for (const seg of segs) {
        if (seg.text.toLowerCase().includes(q)) {
          results.push({
            id: `res_${seg.id}`,
            meetingId: meeting.id,
            meetingTitle: meeting.title,
            segmentId: seg.id,
            speakerName: seg.speakerName,
            startMs: seg.startMs,
            snippet: seg.text,
            score: 0.9,
            kind: "segment",
          });
        }
      }
    }
    if (filters?.speaker) {
      return results.filter((r) => r.speakerName?.toLowerCase().includes(filters.speaker!.toLowerCase()));
    }
    return results;
  },

  async listActionItems(filters?: { status?: ActionItem["status"] }): Promise<ActionItem[]> {
    await delay();
    let rows = [...actionItems];
    if (filters?.status) rows = rows.filter((a) => a.status === filters.status);
    return rows;
  },

  async listCalendarEvents(): Promise<CalendarEvent[]> {
    await delay();
    return [...events];
  },

  async listFolders(): Promise<Folder[]> {
    await delay();
    return [...folders];
  },

  async listChannels(): Promise<Channel[]> {
    await delay();
    return [...channels];
  },

  async listTemplates(): Promise<Template[]> {
    await delay();
    return [...templates];
  },

  async listRecipes(): Promise<Recipe[]> {
    await delay();
    return [...recipes];
  },

  async listSkills(): Promise<Skill[]> {
    await delay();
    return [...skills];
  },

  async listPeople(): Promise<Person[]> {
    await delay();
    return [...people];
  },

  async listCompanies(): Promise<Company[]> {
    await delay();
    return [...companies];
  },

  async listIntegrations(): Promise<Integration[]> {
    await delay();
    return [...integrations];
  },

  async listMembers(): Promise<WorkspaceMember[]> {
    await delay();
    return [...members];
  },

  async listAuditEvents(): Promise<AuditEvent[]> {
    await delay();
    return [...auditEvents];
  },

  async listLegalHolds(): Promise<LegalHold[]> {
    await delay();
    return [...legalHolds];
  },

  async listVocabulary(): Promise<VocabularyTerm[]> {
    await delay();
    return [...vocabulary];
  },

  async getUsage(): Promise<UsageSummary> {
    await delay();
    return { ...SEED_USAGE };
  },

  async updateMeetingStatus(id: string, status: MeetingStatus): Promise<void> {
    await delay();
    const m = meetings.find((x) => x.id === id);
    if (m) m.status = status;
  },

  async createMeeting(input: { title: string; source: Meeting["source"] }): Promise<Meeting> {
    await delay();
    const m: Meeting = {
      id: `m_${Date.now()}`,
      title: input.title,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationSeconds: 0,
      source: input.source,
      status: "processing",
      language: "en",
      ownerId: "u_ava",
      ownerName: "Ava Chen",
      participantCount: 0,
      privacy: "private",
      folderId: null,
      folderName: null,
      channelId: null,
      hasTranscript: false,
      hasSummary: false,
      audioAvailable: true,
      consentMethod: null,
      tags: [],
    };
    meetings.unshift(m);
    return m;
  },

  async uploadRecording(file: { name: string; size: number }): Promise<Meeting> {
    await delay(800);
    return this.createMeeting({ title: file.name.replace(/\.[^.]+$/, ""), source: "upload" });
  },

  async toggleActionItem(id: string): Promise<void> {
    await delay();
    const a = actionItems.find((x) => x.id === id);
    if (a) a.status = a.status === "done" ? "open" : "done";
  },

  async askAI(_question: string, _scope: string): Promise<{ answer: string; citations: { segmentId: string; label: string }[] }> {
    await delay(900);
    return {
      answer:
        "Based on the meetings in scope, the team agreed to target the 14th for launch and to ship the operator budget cap alongside it. Onboarding screens are complete, with the calendar connection still pending.",
      citations: [
        { segmentId: "s1", label: "Q3 planning sync · 00:00" },
        { segmentId: "s4", label: "Q3 planning sync · 00:18" },
      ],
    };
  },
};

export type DataLayer = typeof data;
