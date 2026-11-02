import { mkdir, open, type FileHandle } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * 16 kHz mono 16-bit WAV. The header is reserved up front, then patched with
 * the real sizes at finalize time because the meeting length is unknown.
 */
export class WavWriter {
  private handle: FileHandle | null = null;
  private dataBytes = 0;

  constructor(
    readonly path: string,
    readonly sampleRate = 16_000,
  ) {}

  async open(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    this.handle = await open(this.path, "w");
    await this.handle.write(Buffer.alloc(44));
  }

  async append(pcm: Buffer): Promise<void> {
    if (!this.handle) throw new Error("wav_writer_not_open");
    if (pcm.length === 0) return;
    await this.handle.write(pcm);
    this.dataBytes += pcm.length;
  }

  get durationSeconds(): number {
    return this.dataBytes / (this.sampleRate * 2);
  }

  get bytes(): number {
    return this.dataBytes;
  }

  async finalize(): Promise<void> {
    if (!this.handle) return;
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + this.dataBytes, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(this.sampleRate, 24);
    header.writeUInt32LE(this.sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(this.dataBytes, 40);
    await this.handle.write(header, 0, 44, 0);
    await this.handle.close();
    this.handle = null;
  }
}
