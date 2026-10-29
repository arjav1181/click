import { z } from "zod";
import { aiConfig, smtpConfig, verifySmtp } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";

const schema = z.object({ kind: z.enum(["asr", "llm", "smtp", "embeddings"]) });

async function check(url: string, headers: Record<string, string> = {}) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "request failed" };
  }
}

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, schema);
  const config = aiConfig();

  if (body.kind === "smtp") {
    const result = await verifySmtp();
    return json({ kind: "smtp", ...result, host: smtpConfig().host || null });
  }
  if (body.kind === "asr") {
    if (config.asr.provider === "mock") return json({ kind: "asr", ok: true, message: "Mock ASR is active; no network call needed." });
    if (config.asr.provider === "local") {
      const result = await check(`${config.asr.url.replace(/\/$/, "")}/healthz`);
      return json({ kind: "asr", ...result, message: result.ok ? "ASR service is healthy." : "ASR service did not answer." });
    }
    return json({
      kind: "asr",
      ok: Boolean(config.asr.apiKey),
      message: config.asr.apiKey ? "An API key is configured." : "ASR_API_KEY is missing.",
    });
  }
  if (body.kind === "embeddings") {
    return json({
      kind: "embeddings",
      ok: !config.embeddings.enabled || Boolean(config.embeddings.apiKey),
      message: config.embeddings.enabled ? "Embeddings are enabled." : "Embeddings are disabled.",
    });
  }

  if (config.llm.provider === "mock") {
    return json({ kind: "llm", ok: true, message: "Mock LLM is active; no network call needed." });
  }
  const result = await check(`${config.llm.baseUrl.replace(/\/$/, "")}/models`, {
    ...(config.llm.apiKey ? { Authorization: `Bearer ${config.llm.apiKey}` } : {}),
  });
  return json({
    kind: "llm",
    ...result,
    message: result.ok ? "The LLM endpoint answered." : "The LLM endpoint did not answer. Check the base URL and key.",
  });
});
