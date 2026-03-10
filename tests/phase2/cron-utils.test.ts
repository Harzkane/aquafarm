import test from "node:test";
import assert from "node:assert/strict";
import { clampInt, isCronAuthorized, parseDryRunFlag } from "../../lib/cron-utils";

test("isCronAuthorized validates bearer token exactly", () => {
  assert.equal(isCronAuthorized("abc", "Bearer abc"), true);
  assert.equal(isCronAuthorized("abc", "Bearer wrong"), false);
  assert.equal(isCronAuthorized(undefined, "Bearer abc"), false);
  assert.equal(isCronAuthorized("abc", null), false);
});

test("clampInt returns bounded integer values", () => {
  assert.equal(clampInt("999", 50, 1, 200), 200);
  assert.equal(clampInt("-10", 50, 1, 200), 1);
  assert.equal(clampInt("72.8", 50, 1, 200), 72);
  assert.equal(clampInt("nope", 50, 1, 200), 50);
});

test("parseDryRunFlag only accepts '1'", () => {
  assert.equal(parseDryRunFlag("1"), true);
  assert.equal(parseDryRunFlag("0"), false);
  assert.equal(parseDryRunFlag(null), false);
});

