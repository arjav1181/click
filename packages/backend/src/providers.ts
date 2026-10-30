import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { providerConfigs, withTenant, workspaceRepo } from "@click/db";
import { aiConfig, budgetCapDefault } from "./env";
import { decryptSecret } from "./crypto";

export class BudgetExceededError extends Error {
  readonly code = "budget_exceeded";
  constructor(readonly cap: number, readonly spent: number) {
    super(
      `This workspace has reached its AI budget cap ($${cap.toFixed(2)}). Raise the cap in Admin → AI or wait for the next period.`,
    );
  }
}

export interface AsrSegment {
  speaker?: string | null;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number | null;
}

export interface TranscriptionResult {
  language: string;
  durationMs: number;
  segments: AsrSegment[];
  provider: string;
  model: string;
}

export interface SummarySection {
  key: string;
  title: string;
  body: string;
}

export interface SummaryActionItem {
  text: string;
  assigneeName?: string | null;
  dueAt?: string | null;
  sourceSegmentIndex?: number | null;
}

export interface SummaryCitation {
  sectionKey: string;
  segmentIndex: number;
  quote: string;
}

export interface SummaryResult {
  sections: SummarySection[];
  actionItems: SummaryActionItem[];
  citations: SummaryCitation[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A per-workspace provider override. A self-hosted install can point the
 * pipeline at its own endpoint, model and key without touching the process
 * environment.
 */
export interface ProviderOverride {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  enabled: boolean;
}

/**
 * Reads the default provider row for a workspace and decrypts its key.
 * Returns null when the workspace has no override, so the caller can fall
 * back to the environment configuration.
 */
export async function resolveProviderOverride(
  orgId: string,
  kind: "asr" | "llm" | "embedding",
): Promise<ProviderOverride | null> {
  const ctx = { orgId, userId: "00000000-0000-0000-0000-000000000000" };
  const row = await withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        provider: providerConfigs.provider,
        baseUrl: providerConfigs.baseUrl,
        apiKeyEnc: providerConfigs.apiKeyEnc,
        model: providerConfigs.model,
        status: providerConfigs.status,
        options: providerConfigs.options,
      })
      .from(providerConfigs)
      .where(
        and(
          eq(providerConfigs.orgId, orgId),
          eq(providerConfigs.kind, kind),
          eq(providerConfigs.isDefault, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
  if (!row) return null;
  let apiKey: string | undefined;
  if (row.apiKeyEnc) {
    try {
      apiKey = decryptSecret(row.apiKeyEnc);
    } catch {
      apiKey = undefined;
    }
  }
  const options = (row.options ?? {}) as Record<string, unknown>;
  const enabled = options.enabled !== false && row.status !== "error";
  // A provider row without an explicit model falls back to the workspace
  // default an admin picked under Admin → AI.
  const policy = await workspaceRepo.getAiPolicy({
    orgId,
    userId: "00000000-0000-0000-0000-000000000000",
  });
  const defaultModel = policy.modelDefaults[kind === "embedding" ? "embeddings" : kind];
  return {
    provider: row.provider,
    baseUrl: row.baseUrl ?? undefined,
    apiKey,
    model: row.model ?? defaultModel ?? undefined,
    enabled,
  };
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15 * 60_000) });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Provider returned ${response.status}`);
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Provider request failed");
}

function mockTranscript(filename: string, model?: string): TranscriptionResult {
  const script: Array<[string, number, number, string]> = [
    ["Ava", 0, 6400, "Thanks everyone for joining. I want to keep this to thirty minutes and leave with owners for each item."],
    ["Sam", 6400, 13200, "The main update is that the onboarding flow is finished. The calendar connection is the only piece still open."],
    ["Ava", 13200, 20100, "Good. Do we still agree on launching on the fourteenth, or does the calendar work move that?"],
    ["Sam", 20100, 27400, "I think we can keep the date. I need to confirm the OAuth redirect is registered with Google before Friday."],
    ["Maya", 27400, 34800, "I will finish the empty states and the mobile pass by Wednesday. No blockers on my side."],
    ["Ava", 34800, 41900, "One risk is support load. If self-hosters hit provider setup problems, we need documentation ready on day one."],
    ["Sam", 41900, 48600, "Agreed. I will write the setup guide and test it on a clean install this week."],
    ["Ava", 48600, 55200, "Then the decision is: launch on the fourteenth, documentation is a release blocker, and no paywalls."],
    ["Maya", 55200, 61800, "Should we also add a short in-app checklist for first-time admins?"],
    ["Ava", 61800, 68400, "Yes, that is worth doing. Maya, can you draft it after the mobile pass?"],
  ];
  const provider = aiConfig().asr.provider;
  return {
    language: aiConfig().asr.language || "en",
    durationMs: 68_400,
    provider: provider === "mock" ? "mock" : provider,
    model: model ?? (provider === "mock" ? "click-demo-asr" : aiConfig().asr.model),
    segments: script.map(([speaker, startMs, endMs, text]) => ({
      speaker,
      startMs,
      endMs,
      text,
      confidence: 0.94,
    })),
  };
}

/**
 * Transcribes an audio buffer. `mock` needs no keys and makes a fresh install
 * demoable; `local` talks to apps/asr; `openai` works with any compatible
 * /audio/transcriptions endpoint.
 */
export async function transcribe(input: {
  audio: Buffer;
  filename: string;
  mimeType: string;
  language?: string;
  override?: ProviderOverride | null;
}): Promise<TranscriptionResult> {
  const config = aiConfig().asr;
  // A provider an admin switched off falls back to the operator's env config.
  const override = input.override?.enabled === false ? null : input.override ?? null;
  const provider = override?.provider ?? config.provider;
  const model = override?.model ?? config.model;
  const apiKey = override?.apiKey ?? config.apiKey;
  const baseUrl = override?.baseUrl ?? process.env.ASR_BASE_URL ?? "https://api.openai.com/v1";
  if (provider === "mock") return mockTranscript(input.filename, override?.model);

  const form = new FormData();
  const bytes = new Uint8Array(input.audio.byteLength);
  bytes.set(input.audio);
  form.append("file", new Blob([bytes], { type: input.mimeType }), input.filename);
  if (input.language) form.append("language", input.language);
  form.append("model", model);

  if (provider === "local") {
    const url = override?.baseUrl ?? config.url;
    if (!url) throw new Error("ASR_URL is not set for the local ASR provider.");
    const response = await fetchWithRetry(`${url.replace(/\/$/, "")}/transcribe`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) throw new Error(`ASR service returned ${response.status}`);
    const body = (await response.json()) as {
      language?: string;
      duration_ms?: number;
      segments?: Array<{ start_ms: number; end_ms: number; text: string; speaker?: string; confidence?: number }>;
    };
    return {
      language: body.language ?? input.language ?? "en",
      durationMs: body.duration_ms ?? 0,
      segments: (body.segments ?? []).map((s) => ({
        speaker: s.speaker ?? null,
        startMs: s.start_ms,
        endMs: s.end_ms,
        text: s.text.trim(),
        confidence: s.confidence ?? null,
      })),
      provider: "local",
      model,
    };
  }

  if (!apiKey) throw new Error("ASR_API_KEY is not set for the OpenAI-compatible provider.");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  const response = await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Transcription provider returned ${response.status}: ${detail.slice(0, 300)}`);
  }
  const body = (await response.json()) as {
    language?: string;
    duration?: number;
    segments?: Array<{ start: number; end: number; text: string }>;
    text?: string;
  };
  const segments =
    body.segments?.map((s) => ({
      speaker: null,
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
      confidence: null,
    })) ??
    (body.text
      ? [{ speaker: null, startMs: 0, endMs: Math.round((body.duration ?? 0) * 1000), text: body.text, confidence: null }]
      : []);
  return {
    language: body.language ?? input.language ?? "en",
    durationMs: Math.round((body.duration ?? 0) * 1000),
    segments,
    provider: "openai-compatible",
    model,
  };
}

interface TranscriptLine {
  index: number;
  speaker: string;
  startMs: number;
  text: string;
}

function heuristicSummary(lines: TranscriptLine[], template: string, model?: string): SummaryResult {
  const pick = (test: (line: TranscriptLine) => boolean, limit = 5) =>
    lines.filter(test).slice(0, limit);

  const has = (line: TranscriptLine, words: string[]) =>
    words.some((word) => line.text.toLowerCase().includes(word));

  const overview = lines.slice(0, 3).map((line) => `- ${line.text}`).join("\n");
  const decisions = pick((line) => has(line, ["agree", "decided", "decision", "we will", "i will", "launch on"]));
  const actions = pick((line) => has(line, ["need to", "will ", "can you", "i'll", "confirm", "finish", "write", "draft", "test"]));
  const risks = pick((line) => has(line, ["risk", "concern", "blocker", "problem", "support load"]));
  const questions = pick((line) => line.text.includes("?"));

  const sections: SummarySection[] = [
    { key: "overview", title: "Overview", body: overview || "No overview could be generated from this transcript." },
  ];
  if (decisions.length) {
    sections.push({ key: "decisions", title: "Decisions", body: decisions.map((l) => `- ${l.text}`).join("\n") });
  }
  if (risks.length) {
    sections.push({ key: "risks", title: "Risks", body: risks.map((l) => `- ${l.text}`).join("\n") });
  }
  if (questions.length) {
    sections.push({ key: "open_questions", title: "Open questions", body: questions.map((l) => `- ${l.text}`).join("\n") });
  }
  sections.push({
    key: "action_items",
    title: "Action items",
    body: actions.length ? actions.map((l) => `- ${l.text} (${l.speaker})`).join("\n") : "No action items were detected.",
  });

  const citations: SummaryCitation[] = sections.flatMap((section) => {
    const source = section.key === "overview" ? lines.slice(0, 1) : pick((line) => section.body.includes(line.text), 2);
    return source.map((line) => ({
      sectionKey: section.key,
      segmentIndex: line.index,
      quote: line.text.slice(0, 240),
    }));
  });

  return {
    sections,
    actionItems: actions.slice(0, 10).map((line) => ({
      text: line.text.replace(/^(so|and|then|right)[, ]+/i, "").slice(0, 500),
      assigneeName: line.speaker,
      dueAt: null,
      sourceSegmentIndex: line.index,
    })),
    citations,
    model: model ?? `mock-summary${template ? `:${template}` : ""}`,
    usage: {
      inputTokens: Math.ceil(lines.reduce((sum, line) => sum + line.text.length, 0) / 4),
      outputTokens: Math.ceil(sections.reduce((sum, section) => sum + section.body.length, 0) / 4),
    },
  };
}

const summarySchema = z.object({
  sections: z
    .array(z.object({ key: z.string().min(1).max(60), title: z.string().min(1).max(120), body: z.string().max(20_000) }))
    .min(1)
    .max(20),
  action_items: z
    .array(
      z.object({
        text: z.string().min(1).max(1000),
        assignee: z.string().max(120).nullable().optional(),
        due_at: z.string().nullable().optional(),
        segment_index: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .max(50)
    .default([]),
  citations: z
    .array(
      z.object({
        section_key: z.string().max(60),
        segment_index: z.number().int().nonnegative(),
        quote: z.string().max(500),
      }),
    )
    .max(200)
    .default([]),
});

/**
 * Produces structured notes. `mock` is a deterministic extractive summary so
 * the pipeline and UI work without an API key; any OpenAI-compatible chat
 * endpoint can be used for real summaries.
 */
export async function summarize(input: {
  segments: TranscriptLine[];
  meetingTitle: string;
  template?: string;
  length?: "short" | "standard" | "detailed";
  override?: ProviderOverride | null;
}): Promise<SummaryResult> {
  const config = aiConfig().llm;
  // A provider an admin switched off falls back to the operator's env config.
  const override = input.override?.enabled === false ? null : input.override ?? null;
  const provider = override?.provider ?? config.provider;
  const baseUrl = override?.baseUrl ?? config.baseUrl;
  const apiKey = override?.apiKey ?? config.apiKey;
  const model = override?.model ?? config.model;
  if (provider === "mock") {
    return heuristicSummary(input.segments, input.template ?? "", override?.model);
  }

  if (!apiKey && !/localhost|127\.0\.0\.1/.test(baseUrl)) {
    throw new Error("LLM_API_KEY is not set. Add a key or set LLM_PROVIDER=mock.");
  }

  const transcript = input.segments
    .map((line) => `[${line.index}] ${line.speaker} (${Math.floor(line.startMs / 1000)}s): ${line.text}`)
    .join("\n")
    .slice(0, 120_000);

  const lengthInstruction =
    input.length === "short"
      ? "Keep each section to two sentences."
      : input.length === "detailed"
        ? "Be thorough; each section can use several bullets."
        : "Use short paragraphs or bullets.";

  const prompt = `Meeting title: ${input.meetingTitle}
Template: ${input.template ?? "general meeting notes"}
Length: ${lengthInstruction}

Transcript:
${transcript}

Return JSON with this shape:
{
  "sections": [{"key":"overview","title":"Overview","body":"markdown"}],
  "action_items": [{"text":"...","assignee":"name or null","due_at":null,"segment_index":3}],
  "citations": [{"section_key":"overview","segment_index":3,"quote":"exact words from that segment"}]
}
Use these section keys when the material supports them: overview, decisions, risks, open_questions, action_items. Never invent facts, names, dates or owners that are not in the transcript. If there are no action items, return an empty array.`;

  const response = await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: config.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Click, a careful meeting-notes assistant. You write only from the transcript and answer with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`LLM provider returned ${response.status}: ${detail.slice(0, 300)}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM provider returned an empty response.");
  const parsed = summarySchema.parse(JSON.parse(content));

  return {
    sections: parsed.sections,
    actionItems: parsed.action_items.map((item) => ({
      text: item.text,
      assigneeName: item.assignee ?? null,
      dueAt: item.due_at ?? null,
      sourceSegmentIndex: item.segment_index ?? null,
    })),
    citations: parsed.citations.map((citation) => ({
      sectionKey: citation.section_key,
      segmentIndex: citation.segment_index,
      quote: citation.quote,
    })),
    model,
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    },
  };
}

export interface ChatSnippet {
  meetingId: string;
  meetingTitle: string;
  segmentId: string | null;
  speakerName: string | null;
  startMs: number;
  text: string;
}

export interface ChatCitation {
  meetingId: string;
  segmentId: string | null;
  quote: string;
  label: string;
}

export interface ChatResult {
  answer: string;
  citations: ChatCitation[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export async function chat(input: {
  question: string;
  snippets: ChatSnippet[];
  override?: ProviderOverride | null;
}): Promise<ChatResult> {
  const config = aiConfig().llm;
  const override = input.override?.enabled === false ? null : input.override ?? null;
  const provider = override?.provider ?? config.provider;
  const baseUrl = override?.baseUrl ?? config.baseUrl;
  const apiKey = override?.apiKey ?? config.apiKey;
  const model = override?.model ?? config.model;

  if (provider === "mock") {
    return heuristicChat(input.question, input.snippets, model);
  }

  if (!apiKey && !/localhost|127\.0\.0\.1/.test(baseUrl)) {
    throw new Error("LLM_API_KEY is not set. Add a key or set LLM_PROVIDER=mock.");
  }

  const context = input.snippets
    .slice(0, 40)
    .map(
      (snippet, index) =>
        `[${index}] ${snippet.meetingTitle} · ${snippet.speakerName ?? "Speaker"} (${Math.floor(
          snippet.startMs / 1000,
        )}s): ${snippet.text}`,
    )
    .join("\n")
    .slice(0, 80_000);

  const prompt = `Question: ${input.question}

Sources (numbered):
${context}

Answer the question using only the sources above. Cite the source numbers in square brackets, e.g. [0]. If the sources do not answer the question, say so plainly. Keep the answer concise and well structured.`;

  const response = await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: "system",
          content:
            "You are Click, a careful assistant that answers questions from meeting transcripts and notes. Never invent facts. Cite sources with [n].",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`LLM provider returned ${response.status}: ${detail.slice(0, 300)}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM provider returned an empty response.");

  // Pull source numbers out of the answer text.
  const cited = new Set<number>();
  for (const match of content.matchAll(/\[(\d+)\]/g)) {
    const index = Number(match[1]);
    if (Number.isFinite(index) && index >= 0 && index < input.snippets.length) cited.add(index);
  }
  const citations: ChatCitation[] = [...cited].map((index) => {
    const snippet = input.snippets[index];
    return {
      meetingId: snippet.meetingId,
      segmentId: snippet.segmentId,
      quote: snippet.text.slice(0, 200),
      label: `${snippet.meetingTitle} · ${Math.floor(snippet.startMs / 60000)}:${String(
        Math.floor((snippet.startMs % 60000) / 1000),
      ).padStart(2, "0")}`,
    };
  });

  return {
    answer: content,
    citations,
    model,
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    },
  };
}

function heuristicChat(question: string, snippets: ChatSnippet[], model = "mock-chat"): ChatResult {
  const lower = question.toLowerCase();
  const matched = snippets.filter((snippet) => {
    return snippet.text.toLowerCase().includes(lower.split(/\s+/)[0] ?? "");
  });
  const chosen = (matched.length ? matched : snippets).slice(0, 3);
  const answer =
    chosen.length === 0
      ? "I could not find anything in your meetings that answers that question."
      : `Based on your meetings, here is what I found:\n\n${chosen
          .map((snippet, index) => `- ${snippet.text} [${index}]`)
          .join("\n")}`;
  return {
    answer,
    citations: chosen.map((snippet, index) => ({
      meetingId: snippet.meetingId,
      segmentId: snippet.segmentId,
      quote: snippet.text.slice(0, 200),
      label: `${snippet.meetingTitle} · ${Math.floor(snippet.startMs / 60000)}:${String(
        Math.floor((snippet.startMs % 60000) / 1000),
      ).padStart(2, "0")}`,
    })),
    model,
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

export async function embedTexts(
  texts: string[],
  override?: ProviderOverride | null,
): Promise<number[][] | null> {
  const config = aiConfig().embeddings;
  const active = override?.enabled === false ? null : override ?? null;
  const enabled = active ? active.provider !== "off" : config.enabled;
  if (!enabled || texts.length === 0) return null;
  const baseUrl = active?.baseUrl ?? config.baseUrl;
  const apiKey = active?.apiKey ?? config.apiKey;
  const model = active?.model ?? config.model;
  if (!baseUrl) throw new Error("EMBEDDING_BASE_URL is not set.");
  const response = await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!response.ok) throw new Error(`Embedding provider returned ${response.status}`);
  const body = (await response.json()) as {
    data?: Array<{ embedding: number[]; index: number }>;
  };
  const rows = body.data ?? [];
  return rows.sort((a, b) => a.index - b.index).map((row) => row.embedding);
}

/**
 * Blocks AI spend once the workspace has used its monthly cap. The cap comes
 * from the workspace policy first and falls back to the operator default.
 */
export async function assertBudget(orgId: string): Promise<void> {
  const fallback = budgetCapDefault();
  // The workspace policy cap comes first: it survives a period rollover, when
  // the usage_meters row for the new month does not exist yet.
  const policy = await workspaceRepo.getAiPolicy({
    orgId,
    userId: "00000000-0000-0000-0000-000000000000",
  });
  const policyCap = policy.budgetCap;
  const spent = await withTenant({ orgId, userId: "00000000-0000-0000-0000-000000000000" }, async (tx) => {
    const result = await tx.execute(sql`
      select coalesce(cost_estimate, 0)::float as spent,
             coalesce(budget_cap, ${fallback})::float as cap
      from usage_meters
      where org_id = ${orgId} and period_start = date_trunc('month', now())
      limit 1
    `);
    return (result.rows[0] as { spent: number; cap: number } | undefined) ?? null;
  });
  const cap = policyCap > 0 ? policyCap : spent?.cap ?? fallback;
  if (cap <= 0) return;
  if (spent && spent.spent >= cap) {
    throw new BudgetExceededError(cap, spent.spent);
  }
}

export async function recordUsage(
  orgId: string,
  input: { asrSeconds?: number; tokensIn?: number; tokensOut?: number },
): Promise<void> {
  const pricing = aiConfig().pricing;
  const asrSeconds = Math.max(0, Math.round(input.asrSeconds ?? 0));
  const tokensIn = Math.max(0, Math.round(input.tokensIn ?? 0));
  const tokensOut = Math.max(0, Math.round(input.tokensOut ?? 0));
  const cost =
    (asrSeconds / 60) * pricing.asrPerMinute +
    (tokensIn / 1000) * pricing.llmInPer1k +
    (tokensOut / 1000) * pricing.llmOutPer1k;

  // A new period starts with the workspace cap, so the ledger always carries
  // the limit that applies to the spend it records.
  const policy = await workspaceRepo.getAiPolicy({
    orgId,
    userId: "00000000-0000-0000-0000-000000000000",
  });
  const cap = policy.budgetCap > 0 ? policy.budgetCap : budgetCapDefault();

  await withTenant({ orgId, userId: "00000000-0000-0000-0000-000000000000" }, async (tx) => {
    await tx.execute(sql`
      insert into usage_meters
        (org_id, period_start, period_end, asr_seconds, llm_tokens_in, llm_tokens_out, cost_estimate, budget_cap)
      values
        (${orgId}, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month',
         ${asrSeconds}, ${tokensIn}, ${tokensOut}, ${cost}, ${cap > 0 ? cap : null})
      on conflict (org_id, period_start) do update set
        asr_seconds = usage_meters.asr_seconds + excluded.asr_seconds,
        llm_tokens_in = usage_meters.llm_tokens_in + excluded.llm_tokens_in,
        llm_tokens_out = usage_meters.llm_tokens_out + excluded.llm_tokens_out,
        cost_estimate = usage_meters.cost_estimate + excluded.cost_estimate,
        budget_cap = coalesce(usage_meters.budget_cap, excluded.budget_cap)
    `);
  });
}
