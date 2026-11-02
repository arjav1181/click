import { test } from "node:test";
import assert from "node:assert/strict";
import { CHUNK_SIZE, isChunkInRange, lastChunkIndex } from "./uploadProtocol";

test("a chunk size of 8 MiB splits a recording evenly", () => {
  assert.equal(lastChunkIndex(CHUNK_SIZE * 3), 2);
  assert.equal(lastChunkIndex(CHUNK_SIZE * 3 + 1), 3);
});

test("the last chunk of an exact multiple is the last index", () => {
  assert.equal(lastChunkIndex(CHUNK_SIZE), 0);
  assert.equal(lastChunkIndex(CHUNK_SIZE * 2), 1);
});

test("a chunk index past the end is out of range", () => {
  assert.equal(isChunkInRange(0, 4096), true);
  assert.equal(isChunkInRange(1, 4096), false);
  assert.equal(isChunkInRange(5, 4096), false);
});

test("an unknown size accepts any chunk index", () => {
  assert.equal(isChunkInRange(0, null), true);
  assert.equal(isChunkInRange(99, null), true);
});

test("a negative or fractional chunk index is never valid", () => {
  assert.equal(isChunkInRange(-1, null), false);
  assert.equal(isChunkInRange(1.5, null), false);
});
