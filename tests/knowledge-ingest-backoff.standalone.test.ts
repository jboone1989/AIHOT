import assert from "node:assert/strict";
import { test } from "node:test";
import { graphitiRetryDelayMs } from "../packages/backend/src/knowledge/ingest-backoff.ts";

test("Graphiti retries a failed article after a bounded cooldown, not every 5-minute tick", () => {
  const mins = (n: number) => graphitiRetryDelayMs(n) / 60000;
  assert.deepEqual([1,2,3,4,5,6,7,50].map(mins), [15,30,60,120,240,360,360,360]);
  assert.equal(mins(0), 15);
  assert.equal(mins(-3), 15);
  assert.equal(mins(Number.NaN), 15);
});
