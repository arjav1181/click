import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "./env";

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  mov: "video/quicktime",
  flac: "audio/flac",
  json: "application/json",
  txt: "text/plain",
  md: "text/markdown",
};

const EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function extensionFor(mime: string, filename?: string): string {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  const safe = ["mp3", "wav", "webm", "ogg", "m4a", "mp4", "mov", "flac"];
  if (fromName && safe.includes(fromName)) return fromName;
  return EXT_BY_MIME[mime] ?? "bin";
}

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export function newStorageKey(orgId: string, meetingId: string, mime: string, filename?: string) {
  return `orgs/${orgId}/meetings/${meetingId}/${randomUUID()}.${extensionFor(mime, filename)}`;
}

let s3: S3Client | null = null;
function client(): S3Client {
  if (s3) return s3;
  const config = storageConfig();
  s3 = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : undefined,
  });
  return s3;
}

function localPath(key: string): string {
  const root = path.resolve(storageConfig().dir);
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const config = storageConfig();
  if (config.driver === "s3") {
    await client().send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
    );
    return;
  }
  const target = localPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

export interface ObjectStream {
  body: NodeJS.ReadableStream;
  contentType: string;
  size?: number;
}

export async function getObject(key: string): Promise<ObjectStream | null> {
  const config = storageConfig();
  if (config.driver === "s3") {
    try {
      const result = await client().send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      if (!result.Body) return null;
      return {
        body: result.Body as NodeJS.ReadableStream,
        contentType: result.ContentType ?? contentTypeFor(key),
        size: result.ContentLength,
      };
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }
  const target = localPath(key);
  try {
    const info = await stat(target);
    return {
      body: createReadStream(target),
      contentType: contentTypeFor(key),
      size: info.size,
    };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const config = storageConfig();
  if (config.driver === "s3") {
    await client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    return;
  }
  await rm(localPath(key), { force: true });
}

/**
 * Temporary download URL. S3 returns a presigned URL; the local driver returns
 * an app URL served by the authenticated download route.
 */
export async function presignDownload(key: string, expiresIn = 900): Promise<string> {
  const config = storageConfig();
  if (config.driver === "s3") {
    return getSignedUrl(client(), new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
      expiresIn,
    });
  }
  return `/api/v1/uploads/${encodeURIComponent(key)}?expires=${expiresIn}`;
}

export async function readObjectText(key: string, maxBytes = 1_000_000): Promise<string | null> {
  const object = await getObject(key);
  if (!object) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of object.body as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("Object is too large to read as text");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
