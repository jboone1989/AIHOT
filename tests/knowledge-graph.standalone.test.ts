import {test} from "node:test";
import assert from "node:assert/strict";
import {entityKey,supportedClaims} from "@aihot/backend/knowledge/graph";
test("only explicit relationships whose quotes are in source are accepted",()=>{
 const material="Google announced Gemini 4 Argon on October 13. OpenAI was mentioned in an unrelated paragraph.";
 const good={subject:{name:"Google",kind:"organization" as const},predicate:"released" as const,
 object:{name:"Gemini 4 Argon",kind:"product" as const},evidence:"Google announced Gemini 4 Argon on October 13."};
 const invented={subject:{name:"Google",kind:"organization" as const},predicate:"owns" as const,
 object:{name:"OpenAI",kind:"organization" as const},evidence:"Google owns OpenAI."};
 assert.deepEqual(supportedClaims([good,good,invented],material),[good]);
 assert.equal(entityKey({name:"  GOOGLE  ",kind:"organization"}),"organization:google");
});
test("shared text without asserted relationship produces no edges",()=>{
 const material="Google and OpenAI appeared in the event. There was no partnership announcement.";
 const hypothetical={subject:{name:"Google",kind:"organization" as const},predicate:"partnered_with" as const,
 object:{name:"OpenAI",kind:"organization" as const},evidence:"Google partnered with OpenAI."};
 assert.equal(supportedClaims([hypothetical],material).length,0);
});
