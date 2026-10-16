import assert from "node:assert/strict";
import {test} from "node:test";
import { probeAttemptTag } from "@aihot/backend/providers/nvidia-routing";
import { logicalKeyFor } from "@aihot/backend/providers/receipts";
test("a new minute issues a new paid synthetic probe rather than reusing an old response",()=>{
 const start=probeAttemptTag(new Date("2026-10-16T15:00:02Z"));
 const next=probeAttemptTag(new Date("2026-10-16T15:05:02Z"));
 const req=(attemptTag:string)=>({service:"nvidia",model:"openai/gpt-oss-20b",
  purpose:"nvidia_model_probe",subject:"nvidia:gptoss",identity:{probe:"fixed"},attemptTag});
 assert.notEqual(start,next);
 assert.notEqual(logicalKeyFor(req(start)),logicalKeyFor(req(next)));
 assert.equal(logicalKeyFor(req(start)),logicalKeyFor(req(start)));
});
