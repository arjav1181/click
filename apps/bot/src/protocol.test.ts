import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseJoinRequest, hostMatchesProvider } from "./types";
import { verifySignature } from "./http";

const valid = {
  botJobId: "job-1",
  orgId: "org-1",
  meetingId: "meeting-1",
  provider: "meet",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  botName: "Click bot",
  consentNotice: "This meeting is being recorded.",
  callbackBaseUrl: "https://click.example.com/internal/v1/bots",
};

test("accepts a Meet join body", () => {
  const result = parseJoinRequest(valid);
  assert.ok("request" in result);
  assert.equal(result.request.provider, "meet");
});

test("rejects a provider/host mismatch", () => {
  const result = parseJoinRequest({ ...valid, provider: "zoom" });
  assert.ok("error" in result);
  assert.match(result.error, /does not look like/);
});

test("rejects unknown providers and missing fields", () => {
  assert.ok("error" in parseJoinRequest({ ...valid, provider: "bluejeans" }));
  assert.ok("error" in parseJoinRequest({ ...valid, botJobId: "" }));
});

test("host matching respects subdomains and suffixes", () => {
  assert.equal(hostMatchesProvider("meet", "https://meet.google.com/abc"), true);
  assert.equal(hostMatchesProvider("teams", "https://teams.microsoft.com/l/meetup"), true);
  assert.equal(hostMatchesProvider("meet", "https://meet.google.com.evil.test/abc"), false);
});

test("verifies HMAC over the exact body", () => {
  const body = Buffer.from(JSON.stringify(valid));
  const secret = "test-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifySignature(body, `sha256=${signature}`, secret), true);
  assert.equal(verifySignature(body, signature, "other-secret"), false);
  assert.equal(verifySignature(Buffer.from("tampered"), signature, secret), false);
});
