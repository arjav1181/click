import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WavWriter } from "./wav";

test("writes a valid 16 kHz mono PCM header", async () => {
  const dir = await mkdtemp(join(tmpdir(), "click-wav-"));
  try {
    const path = join(dir, "meeting.wav");
    const writer = new WavWriter(path);
    await writer.open();
    await writer.append(Buffer.alloc(3200)); // 100 ms of silence
    await writer.finalize();

    const bytes = await readFile(path);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    assert.equal(bytes.toString("ascii", 36, 40), "data");
    assert.equal(bytes.readUInt16LE(20), 1);
    assert.equal(bytes.readUInt16LE(22), 1);
    assert.equal(bytes.readUInt32LE(24), 16_000);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal(bytes.readUInt32LE(40), 3200);
    assert.equal(bytes.length, 44 + 3200);
    assert.equal(writer.durationSeconds, 0.1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
