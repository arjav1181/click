import { spawn } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getObject } from "./storage";

/**
 * Extracts a single frame from a stored recording at the given timestamp.
 * Returns a base64-encoded JPEG, or null when the recording cannot be read.
 */
export async function extractFrame(storageKey: string, timestampMs: number): Promise<string | null> {
  const object = await getObject(storageKey);
  if (!object) return null;

  const inputPath = path.join("/tmp/opencode", `frame-input-${Date.now()}.bin`);
  const chunks: Buffer[] = [];
  for await (const chunk of object.body as AsyncIterable<Buffer>) {
    chunks.push(Buffer.from(chunk));
  }
  await writeFile(inputPath, Buffer.concat(chunks));

  const outPath = path.join("/tmp/opencode", `frame-${Date.now()}.jpg`);
  const seconds = Math.max(0, timestampMs / 1000);
  const ok = await new Promise<boolean>((resolve) => {
    const proc = spawn("ffmpeg", [
      "-ss",
      seconds.toFixed(3),
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "4",
      "-y",
      outPath,
    ]);
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });

  try {
    await (await import("node:fs/promises")).rm(inputPath, { force: true });
  } catch {
    // ignore
  }

  if (!ok) return null;
  try {
    const info = await stat(outPath);
    if (info.size === 0) return null;
    const buffer = await readFile(outPath);
    await (await import("node:fs/promises")).rm(outPath, { force: true });
    return buffer.toString("base64");
  } catch {
    return null;
  }
}
