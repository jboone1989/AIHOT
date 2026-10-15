import assert from "node:assert/strict";
import {localizedMonthDay,localizedWeekday,localizedMonthDayTime,localizedDateTime,localizedRelativeTime} from "../apps/web/app/lib/format.ts";
const day="2026-10-15",time="2026-10-15T04:35:00.000Z";
assert.equal(localizedMonthDay(day,"en"),"Oct 15");
assert.equal(localizedWeekday(day,"en"),"Thursday");
for(const value of [localizedMonthDay(day,"en"),localizedWeekday(day,"en"),localizedMonthDayTime(time,"en"),localizedDateTime(time,"en"),localizedRelativeTime(time,"en",Date.parse(time)+120000)]){
 assert.equal(/[\u3400-\u9fff]/u.test(value),false,"English formatter returned CJK: "+value);
}
assert.match(localizedMonthDayTime(time,"en"),/Oct 15.*12:35/);
assert.equal(localizedMonthDay(day,"zh"),"10月15日");
console.log("English system date/count format assertions passed");
