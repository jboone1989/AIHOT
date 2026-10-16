import assert from "node:assert/strict";
import { test } from "node:test";
import { autoReleaseConfigured } from "../packages/backend/src/operations/recover.ts";

test("unknown paid calls require verification by default", () => {
  assert.equal(autoReleaseConfigured(undefined), false);
  assert.equal(autoReleaseConfigured(""), false);
  assert.equal(autoReleaseConfigured("false"), false);
  assert.equal(autoReleaseConfigured("TRUE"), false);
  assert.equal(autoReleaseConfigured("true"), true);
});
