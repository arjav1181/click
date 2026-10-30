/**
 * Export formats.
 *
 * Every meeting can leave Click as notes (Markdown, plain text, PDF, Word),
 * as subtitles (SRT, WebVTT), as raw data (JSON) or as the original audio
 * (MP3). The text formats are rendered here so the single-meeting route and
 * the bulk archive produce byte-identical files.
 */

export const EXPORT_FORMATS = ["md", "txt", "pdf", "docx", "srt", "vtt", "json", "mp3"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  srt: "application/x-subrip; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  json: "application/json; charset=utf-8",
  mp3: "audio/mpeg",
};

export interface ExportSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerName: string | null;
}

export interface ExportSection {
  id: string;
  title: string;
  body: string;
}

export interface ExportNote {
  rawMarkdown: string | null;
  generatedAt: string | null;
  sections: ExportSection[];
}

export interface ExportMeeting {
  id: string;
  title: string;
  startedAt: string | null;
  durationSeconds: number;
  language: string;
  source: string;
  status: string;
  privacy: string;
  ownerName: string;
}

export interface ExportPayload {
  meeting: ExportMeeting;
  note: ExportNote | null;
  segments: ExportSegment[];
}

export function exportFilename(title: string, extension: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "meeting"}.${extension}`;
}

function clock(ms: number, separator: "," | ".") {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(
    Math.floor((Math.max(0, ms) % 1000) / 10),
    3,
  )}`;
}

function metaLines(payload: ExportPayload): string[] {
  const lines: string[] = [];
  if (payload.meeting.startedAt) {
    lines.push(new Date(payload.meeting.startedAt).toUTCString());
  }
  lines.push(`${Math.round(payload.meeting.durationSeconds / 60)} min`);
  lines.push(`${payload.meeting.ownerName} · ${payload.meeting.language} · ${payload.meeting.source}`);
  return lines;
}

export function renderMarkdown(payload: ExportPayload): string {
  const parts: string[] = [`# ${payload.meeting.title}`, ""];
  parts.push(`_${metaLines(payload).join(" · ")}_`, "");
  if (payload.note?.sections.length) {
    for (const section of payload.note.sections) {
      parts.push(`## ${section.title}`, "", section.body.trim(), "");
    }
  } else if (payload.note?.rawMarkdown) {
    parts.push(payload.note.rawMarkdown.trim(), "");
  } else {
    parts.push("_No notes yet._", "");
  }
  if (payload.segments.length) {
    parts.push("## Transcript", "");
    for (const segment of payload.segments) {
      parts.push(
        `**${segment.speakerName ?? "Speaker"}** · ${clock(segment.startMs, ",")}`,
        "",
        segment.text,
        "",
      );
    }
  }
  return parts.join("\n");
}

export function renderText(payload: ExportPayload): string {
  const lines: string[] = [payload.meeting.title, metaLines(payload).join(" · "), ""];
  if (payload.note?.sections.length) {
    for (const section of payload.note.sections) {
      lines.push(section.title.toUpperCase(), section.body.trim(), "");
    }
  } else if (payload.note?.rawMarkdown) {
    lines.push(payload.note.rawMarkdown.trim(), "");
  }
  if (payload.segments.length) {
    lines.push("TRANSCRIPT", "");
    for (const segment of payload.segments) {
      lines.push(
        `[${clock(segment.startMs, ",").slice(3)}] ${segment.speakerName ?? "Speaker"}: ${segment.text}`,
      );
    }
  }
  return lines.join("\n") + "\n";
}

export function renderJson(payload: ExportPayload): string {
  return JSON.stringify(
    {
      meeting: payload.meeting,
      note: payload.note,
      transcript: payload.segments,
    },
    null,
    2,
  );
}

export function renderSrt(payload: ExportPayload): string {
  const blocks = payload.segments.map((segment, index) => {
    const start = clock(segment.startMs, ",");
    const end = clock(Math.max(segment.endMs, segment.startMs + 1), ",");
    const speaker = segment.speakerName ? `${segment.speakerName}: ` : "";
    return `${index + 1}\n${start} --> ${end}\n${speaker}${segment.text}`;
  });
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

export function renderVtt(payload: ExportPayload): string {
  const blocks = payload.segments.map((segment) => {
    const start = clock(segment.startMs, ".");
    const end = clock(Math.max(segment.endMs, segment.startMs + 1), ".");
    const speaker = segment.speakerName ? `<v ${segment.speakerName}>` : "";
    return `${start} --> ${end}\n${speaker}${segment.text}`;
  });
  return `WEBVTT\n\n${blocks.join("\n\n")}${blocks.length ? "\n" : ""}`;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN = 56;
const PDF_LINE_HEIGHT = 15;

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Latin-1 is enough for the PDF base-14 fonts; anything else is dropped. */
function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

/** Greedy word wrap so long lines do not run off the page. */
function wrapText(value: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (current === "") {
        current = word;
      } else if (current.length + 1 + word.length <= maxChars) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current !== "") lines.push(current);
  }
  return lines;
}

interface PdfLine {
  text: string;
  bold: boolean;
  size: number;
  gapAfter: number;
}

export function renderPdf(payload: ExportPayload): Buffer {
  const lines: PdfLine[] = [];
  lines.push({ text: payload.meeting.title, bold: true, size: 18, gapAfter: 4 });
  for (const meta of metaLines(payload)) {
    lines.push({ text: meta, bold: false, size: 10, gapAfter: 0 });
  }
  lines.push({ text: "", bold: false, size: 10, gapAfter: 0 });

  if (payload.note?.sections.length) {
    for (const section of payload.note.sections) {
      lines.push({ text: section.title, bold: true, size: 13, gapAfter: 2 });
      for (const line of wrapText(section.body.trim(), 88)) {
        lines.push({ text: line, bold: false, size: 10, gapAfter: 0 });
      }
      lines.push({ text: "", bold: false, size: 10, gapAfter: 0 });
    }
  } else if (payload.note?.rawMarkdown) {
    for (const line of wrapText(payload.note.rawMarkdown.trim(), 88)) {
      lines.push({ text: line, bold: false, size: 10, gapAfter: 0 });
    }
    lines.push({ text: "", bold: false, size: 10, gapAfter: 0 });
  } else {
    lines.push({ text: "No notes yet.", bold: false, size: 10, gapAfter: 0 });
    lines.push({ text: "", bold: false, size: 10, gapAfter: 0 });
  }

  if (payload.segments.length) {
    lines.push({ text: "Transcript", bold: true, size: 13, gapAfter: 2 });
    for (const segment of payload.segments) {
      const stamp = clock(segment.startMs, ",").slice(3, 8);
      lines.push({
        text: `${stamp}  ${segment.speakerName ?? "Speaker"}`,
        bold: true,
        size: 10,
        gapAfter: 0,
      });
      for (const line of wrapText(segment.text, 84)) {
        lines.push({ text: line, bold: false, size: 10, gapAfter: 0 });
      }
    }
  }

  // Lay the lines out on pages.
  const usableHeight = PDF_PAGE_HEIGHT - PDF_MARGIN * 2;
  const pages: PdfLine[][] = [];
  let current: PdfLine[] = [];
  let used = 0;
  for (const line of lines) {
    const height = line.size * 1.2 + line.gapAfter + (line.size <= 10 ? 3 : 4);
    if (used + height > usableHeight && current.length) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(line);
    used += height;
  }
  if (current.length) pages.push(current);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  // 1 catalog, 2 pages tree, 3 regular font, 4 bold font, then page/content pairs.
  let objectId = 5;
  for (let index = 0; index < pages.length; index += 1) {
    pageObjectIds.push(objectId);
    objectId += 2;
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pages.length} >>\nendobj\n`,
  );
  objects.push(
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
  );
  objects.push(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
  );

  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = pageId + 1;
    let cursor = PDF_PAGE_HEIGHT - PDF_MARGIN;
    const body: string[] = ["BT"];
    for (const line of pageLines) {
      cursor -= line.size * 1.2 + line.gapAfter;
      const font = line.bold ? "/F2" : "/F1";
      body.push(`${font} ${line.size} Tf`);
      body.push(`1 0 0 1 ${PDF_MARGIN} ${cursor.toFixed(2)} Tm`);
      body.push(`(${pdfEscape(pdfText(line.text))}) Tj`);
      cursor -= line.size <= 10 ? 3 : 4;
    }
    body.push("ET");
    const stream = body.join("\n");
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

// Numeric character references keep the XML valid without relying on named
// entities.
const XML_ENTITIES: Record<string, string> = {
  "&": "&#38;",
  "<": "&#60;",
  ">": "&#62;",
  '"': "&#34;",
  "'": "'",
};

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ENTITIES[char]);
}

/**
 * Word documents are zip archives of XML parts. Only the three parts Word
 * needs are written, and the archive uses the stored (uncompressed) method so
 * no deflate implementation is required.
 */
export function renderDocx(payload: ExportPayload): Buffer {
  const paragraphs: string[] = [];
  paragraphs.push(
    `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(
      payload.meeting.title,
    )}</w:t></w:r></w:p>`,
  );
  for (const meta of metaLines(payload)) {
    paragraphs.push(
      `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(meta)}</w:t></w:r></w:p>`,
    );
  }

  if (payload.note?.sections.length) {
    for (const section of payload.note.sections) {
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(
          section.title,
        )}</w:t></w:r></w:p>`,
      );
      for (const block of section.body.trim().split(/\r?\n/)) {
        paragraphs.push(
          `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(block)}</w:t></w:r></w:p>`,
        );
      }
    }
  } else if (payload.note?.rawMarkdown) {
    for (const block of payload.note.rawMarkdown.trim().split(/\r?\n/)) {
      paragraphs.push(
        `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(block)}</w:t></w:r></w:p>`,
      );
    }
  }

  if (payload.segments.length) {
    paragraphs.push(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">Transcript</w:t></w:r></w:p>`,
    );
    for (const segment of payload.segments) {
      const stamp = clock(segment.startMs, ",").slice(3, 8);
      paragraphs.push(
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEscape(
          `${stamp}  ${segment.speakerName ?? "Speaker"}`,
        )}</w:t></w:r></w:p>`,
      );
      paragraphs.push(
        `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(segment.text)}</w:t></w:r></w:p>`,
      );
    }
  }

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${paragraphs.join("")}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>` +
    `</w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const documentRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>` +
    `</w:styles>`;

  return zip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rels, "utf8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
    { name: "word/_rels/document.xml.rels", data: Buffer.from(documentRels, "utf8") },
    { name: "word/styles.xml", data: Buffer.from(styles, "utf8") },
  ]);
}

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a zip archive with the stored method. Every entry keeps its own
 * timestamp, so the archive is byte-stable for the same input.
 */
export function zip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, file.data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0x21, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(file.data.length, 20);
    header.writeUInt32LE(file.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);

    offset += local.length + name.length + file.data.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuffer, end]);
}
