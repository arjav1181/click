import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { isMailConfigured, isProduction, smtpConfig } from "./env";
import type { EmailContent } from "./emails";

let transporter: Transporter | null = null;

function transport(): Transporter {
  if (transporter) return transporter;
  const config = smtpConfig();
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    // Fail fast instead of hanging a request for a minute.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

export interface MailResult {
  delivered: boolean;
  preview?: string;
  devLink?: string;
}

function extractLink(content: EmailContent): string | undefined {
  return content.text.match(/https?:\/\/\S+/)?.[0];
}

/**
 * Sends mail when SMTP is configured. Without SMTP the message is written to
 * .data/mail so a self-hoster can see exactly what would have gone out. In
 * production a missing SMTP config is an error, not a silent drop.
 */
export async function sendMail(input: {
  to: string;
  content: EmailContent;
  /** Return the action link in the response in development only. */
  revealLink?: boolean;
}): Promise<MailResult> {
  if (!isMailConfigured()) {
    if (isProduction()) {
      throw new Error("SMTP is not configured. Set SMTP_HOST and MAIL_FROM, or use the CLI.");
    }
    const dir = path.resolve(process.env.STORAGE_DIR ?? ".data", "mail");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
    await writeFile(file, input.content.html, "utf8");
    console.info(`[mail] SMTP not configured; wrote ${file} for ${input.to}`);
    return {
      delivered: false,
      preview: file,
      devLink: input.revealLink ? extractLink(input.content) : undefined,
    };
  }

  await transport().sendMail({
    from: smtpConfig().from,
    to: input.to,
    subject: input.content.subject,
    text: input.content.text,
    html: input.content.html,
  });
  return { delivered: true };
}

export async function verifySmtp(): Promise<{ ok: boolean; message: string }> {
  if (!isMailConfigured()) return { ok: false, message: "SMTP_HOST is not set." };
  try {
    await transport().verify();
    return { ok: true, message: "SMTP connection verified." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "SMTP verification failed." };
  }
}
