import { test } from "node:test";
import assert from "node:assert/strict";
import { detectJoinState, JITSI_TEXT, MEET_TEXT } from "./join";

test("a wrong Meet code is reported as a missing meeting, not a denial", () => {
  const text = "Returning to home screen Check your meeting code Make sure you entered the correct code.";
  const state = detectJoinState(text, MEET_TEXT);
  assert.equal(state?.reason, "meeting_not_found");
  assert.match(state?.detail ?? "", /meeting code/i);
});

test("a host denial wins over the generic home-screen wording", () => {
  const text = "Returning to home screen You can't join this video call";
  const state = detectJoinState(text, MEET_TEXT);
  assert.equal(state?.reason, "join_denied");
});

test("the Meet lobby is detected once", () => {
  const text = "Waiting for someone to let you in";
  assert.equal(detectJoinState(text, MEET_TEXT)?.reason, "lobby");
});

test("an ordinary join screen matches nothing", () => {
  assert.equal(detectJoinState("Your name Join now", MEET_TEXT), null);
});

test("the Jitsi lobby is detected", () => {
  assert.equal(detectJoinState("Waiting for a moderator", JITSI_TEXT)?.reason, "lobby");
});

test("a Jitsi disconnect is a denial", () => {
  assert.equal(detectJoinState("You have been disconnected", JITSI_TEXT)?.reason, "join_denied");
});
