/** Transactional email copy and markup. Written for Click, no vendor templates. */

const brand = {
  bg: "#f6f7f9",
  card: "#ffffff",
  text: "#18202a",
  muted: "#5b6675",
  accent: "#0f6b5f",
  border: "#e3e7ec",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(input: { title: string; body: string; footer: string }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:${brand.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${brand.text};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
      <tr><td style="padding-bottom:20px;">
        <span style="display:inline-block;width:28px;height:28px;border-radius:6px;background:${brand.accent};color:#fff;font-weight:700;text-align:center;line-height:28px;font-size:14px;">C</span>
        <span style="font-weight:600;font-size:16px;margin-left:8px;vertical-align:middle;">Click</span>
      </td></tr>
      <tr><td style="background:${brand.card};border:1px solid ${brand.border};border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${escapeHtml(input.title)}</h1>
        ${input.body}
      </td></tr>
      <tr><td style="padding:16px 4px 0;color:${brand.muted};font-size:12px;line-height:1.6;">${input.footer}</td></tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:20px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${brand.accent};color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(label)}</a></p>`;
}

function linkFallback(href: string) {
  return `<p style="margin:16px 0 0;color:${brand.muted};font-size:12px;word-break:break-all;">If the button does not work, paste this link into your browser:<br>${escapeHtml(href)}</p>`;
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const signoff = "You are receiving this because someone used your address on this Click instance. If that was not you, you can ignore this email.";

export function verifyEmail(input: { name: string; url: string }): EmailContent {
  const safeName = input.name.trim() || "there";
  return {
    subject: "Verify your email for Click",
    text: `Hi ${safeName},\n\nConfirm your email address to finish setting up Click:\n${input.url}\n\nThis link expires in 24 hours. ${signoff}\n`,
    html: layout({
      title: "Verify your email",
      body: `<p style="margin:0;font-size:14px;line-height:1.6;">Hi ${escapeHtml(safeName)}, confirm your email address to finish setting up Click.</p>${button(input.url, "Verify email")}${linkFallback(input.url)}<p style="margin:16px 0 0;color:${brand.muted};font-size:12px;">This link expires in 24 hours.</p>`,
      footer: signoff,
    }),
  };
}

export function magicLink(input: { url: string; minutes: number }): EmailContent {
  return {
    subject: "Your Click sign-in link",
    text: `Sign in to Click:\n${input.url}\n\nThe link expires in ${input.minutes} minutes and can be used once. ${signoff}\n`,
    html: layout({
      title: "Sign in to Click",
      body: `<p style="margin:0;font-size:14px;line-height:1.6;">Use the button below to sign in. The link expires in ${input.minutes} minutes and can be used once.</p>${button(input.url, "Sign in")}${linkFallback(input.url)}`,
      footer: signoff,
    }),
  };
}

export function resetPassword(input: { url: string; minutes: number }): EmailContent {
  return {
    subject: "Reset your Click password",
    text: `Reset your Click password:\n${input.url}\n\nThe link expires in ${input.minutes} minutes and can be used once. If you did not ask for this, no change has been made.\n`,
    html: layout({
      title: "Reset your password",
      body: `<p style="margin:0;font-size:14px;line-height:1.6;">Choose a new password with the button below. The link expires in ${input.minutes} minutes and can be used once.</p>${button(input.url, "Choose a new password")}${linkFallback(input.url)}<p style="margin:16px 0 0;color:${brand.muted};font-size:12px;">If you did not ask for this, no change has been made.</p>`,
      footer: signoff,
    }),
  };
}

export function invitation(input: {
  inviter: string;
  org: string;
  url: string;
  role: string;
}): EmailContent {
  return {
    subject: `${input.inviter} invited you to ${input.org} on Click`,
    text: `${input.inviter} invited you to join ${input.org} on Click as ${input.role}.\n\nAccept the invitation:\n${input.url}\n\nThe invitation expires in 7 days.\n`,
    html: layout({
      title: `Join ${input.org}`,
      body: `<p style="margin:0;font-size:14px;line-height:1.6;"><strong>${escapeHtml(input.inviter)}</strong> invited you to join <strong>${escapeHtml(input.org)}</strong> on Click as ${escapeHtml(input.role)}.</p>${button(input.url, "Accept invitation")}${linkFallback(input.url)}<p style="margin:16px 0 0;color:${brand.muted};font-size:12px;">The invitation expires in 7 days.</p>`,
      footer: "Click is self-hosted by your team. The instance operator manages this email.",
    }),
  };
}

export function smtpTest(input: { url: string }): EmailContent {
  return {
    subject: "Click SMTP test",
    text: `SMTP is configured correctly. Open your workspace: ${input.url}\n`,
    html: layout({
      title: "SMTP is working",
      body: `<p style="margin:0;font-size:14px;line-height:1.6;">Click sent this message through your SMTP server. Transactional email is configured correctly.</p>${button(input.url, "Open Click")}`,
      footer: signoff,
    }),
  };
}
