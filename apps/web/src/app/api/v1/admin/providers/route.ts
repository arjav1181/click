import { aiConfig, isMailConfigured, smtpConfig } from "@click/backend";
import { handler, json } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";

const mask = (value: string) => (value ? `${value.slice(0, 4)}…${value.slice(-2)}` : "");

export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const config = aiConfig();
  return json({
    providers: [
      {
        kind: "asr",
        provider: config.asr.provider,
        model: config.asr.provider === "mock" ? "click-demo-asr" : config.asr.model,
        configured: config.asr.provider === "mock" || Boolean(config.asr.apiKey || config.asr.url),
        endpoint: config.asr.url || null,
        key: mask(config.asr.apiKey),
      },
      {
        kind: "llm",
        provider: config.llm.provider,
        model: config.llm.provider === "mock" ? "click-demo-llm" : config.llm.model,
        configured: config.llm.provider === "mock" || Boolean(config.llm.apiKey),
        endpoint: config.llm.baseUrl,
        key: mask(config.llm.apiKey),
      },
      {
        kind: "embeddings",
        provider: config.embeddings.enabled ? "openai-compatible" : "off",
        model: config.embeddings.model,
        configured: !config.embeddings.enabled || Boolean(config.embeddings.apiKey),
        dimensions: config.embeddings.dimensions,
      },
      {
        kind: "smtp",
        provider: isMailConfigured() ? "smtp" : "off",
        model: null,
        configured: isMailConfigured(),
        endpoint: smtpConfig().host || null,
        key: "",
      },
    ],
    pricing: config.pricing,
  });
});
