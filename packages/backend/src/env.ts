/**
 * Environment access for server code. Nothing is validated at import time so
 * `next build` works without secrets; routes that need a value fail loudly at
 * request time with a message naming the variable.
 */

function bool(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env (see .env.example).`);
  }
  return value;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieName() {
  return process.env.SESSION_COOKIE_NAME ?? "click_session";
}

export function smtpConfig() {
  return {
    host: process.env.SMTP_HOST ?? "",
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM ?? "Click <click@localhost>",
  };
}

export function isMailConfigured() {
  return Boolean(smtpConfig().host);
}

export function storageConfig() {
  return {
    driver: process.env.STORAGE_DRIVER === "s3" ? ("s3" as const) : ("local" as const),
    dir: process.env.STORAGE_DIR ?? ".data/uploads",
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "click",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
    maxUploadMb: int(process.env.MAX_UPLOAD_MB, 500),
  };
}

export function redisUrl() {
  return process.env.REDIS_URL ?? "";
}

export function aiConfig() {
  return {
    asr: {
      provider: process.env.ASR_PROVIDER ?? "mock",
      url: process.env.ASR_URL ?? "",
      apiKey: process.env.ASR_API_KEY ?? "",
      model: process.env.ASR_MODEL ?? "whisper-1",
      language: process.env.ASR_LANGUAGE ?? "",
    },
    llm: {
      provider: process.env.LLM_PROVIDER ?? "mock",
      baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: process.env.LLM_API_KEY ?? "",
      model: process.env.LLM_MODEL ?? "gpt-4o-mini",
      maxTokens: int(process.env.LLM_MAX_TOKENS, 3000),
    },
    embeddings: {
      enabled: bool(process.env.EMBEDDINGS_ENABLED, false),
      baseUrl: process.env.EMBEDDING_BASE_URL ?? process.env.LLM_BASE_URL ?? "",
      apiKey: process.env.EMBEDDING_API_KEY ?? process.env.LLM_API_KEY ?? "",
      model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
      dimensions: int(process.env.EMBEDDING_DIMENSIONS, 1536),
    },
    pricing: {
      asrPerMinute: Number(process.env.ASR_COST_PER_MINUTE ?? 0),
      llmInPer1k: Number(process.env.LLM_INPUT_COST_PER_1K ?? 0),
      llmOutPer1k: Number(process.env.LLM_OUTPUT_COST_PER_1K ?? 0),
    },
  };
}

export function budgetCapDefault() {
  const value = Number(process.env.BUDGET_CAP_USD ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function encryptionKeySource() {
  return process.env.ENCRYPTION_KEY ?? process.env.APP_SECRET ?? "";
}

export function botWebhookSecret() {
  return process.env.BOT_WEBHOOK_SECRET ?? "";
}

export function oidcConfig() {
  return {
    issuer: process.env.OIDC_ISSUER ?? "",
    clientId: process.env.OIDC_CLIENT_ID ?? "",
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
    name: process.env.OIDC_DISPLAY_NAME ?? "Single sign-on",
    scopes: process.env.OIDC_SCOPES ?? "openid email profile",
  };
}

export function isOidcConfigured() {
  const config = oidcConfig();
  return Boolean(config.issuer && config.clientId && config.clientSecret);
}

export function uploadLimits() {
  return {
    maxBytes: storageConfig().maxUploadMb * 1024 * 1024,
    allowedMime: new Set([
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/x-m4a",
      "audio/flac",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ]),
  };
}
