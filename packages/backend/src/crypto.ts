import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { encryptionKeySource, isProduction } from "./env";

const DEV_KEY = "click-dev-only-encryption-key-change-me";

function key(): Buffer {
  const source = encryptionKeySource() || (isProduction() ? "" : DEV_KEY);
  if (!source) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.",
    );
  }
  // Accept a raw 32-byte base64/hex value, or derive a key from a passphrase.
  const decoded = Buffer.from(source, "base64");
  if (decoded.length === 32) return decoded;
  const hex = Buffer.from(source, "hex");
  if (hex.length === 32 && /^[0-9a-f]+$/i.test(source)) return hex;
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unsupported encrypted value");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
