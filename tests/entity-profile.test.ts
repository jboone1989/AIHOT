// The entity profile lists only reports that are public now, and groups them into their live stories.
import './setup.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { sql, closeDb } from '@aihot/backend/db';
import { citedReports } from '@aihot/backend/publication/knowledge';

after(closeDb);

test('cited reports keep only public ones, newest first, grouped into live stories', async () => {
  const source = 'entity-profile';
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode,next_fetch_at)
    VALUES (${source},${source},'rss','T1','editorial','2100-01-01')`;
  const [story] = await sql<{id:number;public_id:string}[]>`INSERT INTO stories (public_id,title)
    VALUES (${randomUUID()},'实体档案事件') RETURNING id,public_id`;
  const [fact] = await sql<{id:number}[]>`INSERT INTO facts (public_id,story_id,title)
    VALUES (${randomUUID()},${story!.id},'实体档案事件') RETURNING id`;
  const reports = [
    ['ep-old', 'Older report', 3, true],
    ['ep-new', '较新的报道', 1, true],
    ['ep-withdrawn', 'Withdrawn report', 2, true],
    ['ep-loose', 'Report without a story', 4, false],
  ] as const;
  for (const [id, original, hoursAgo, inStory] of reports) {
    const at = new Date(Date.now() - hoursAgo * 3600_000);
    await sql`INSERT INTO articles (id,source_id,identity_key,url,title,discovered_at,timeline_at)
      VALUES (${id},${source},${id},${'https://example.org/'+id},${id},${at},${at})`;
    if (inStory) await sql`INSERT INTO fact_articles (fact_id,article_id,role) VALUES (${fact!.id},${id},'report')`;
    await sql`INSERT INTO publications (article_id,source_id,title,original_title,url,timeline_at,discovered_at,sort_at,body_mode,eligible,channel,story_id,fact_id)
      VALUES (${id},${source},${id},${original},${'https://example.org/'+id},${at},${at},${at},'summary',true,'news',
        ${inStory ? story!.id : null},${inStory ? fact!.id : null})`;
  }
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = 'ep-withdrawn'`;

  const { reports: listed, stories } = await citedReports(['ep-old', 'ep-new', 'ep-withdrawn', 'ep-loose', 'ep-unknown']);
  assert.deepEqual(listed.map((r) => r.id), ['ep-new', 'ep-old', 'ep-loose'], 'withdrawn and unknown reports are left out');
  assert.equal(listed[0]!.source.firstParty, true);
  assert.equal(stories.length, 1);
  assert.equal(stories[0]!.publicId, story!.public_id);
  assert.equal(stories[0]!.reportCount, 2, 'only the cited reports of the story are counted');
  assert.equal(stories[0]!.englishTitle, 'Older report', 'a Chinese original title is never offered as English');
  assert.deepEqual(await citedReports([]), { reports: [], stories: [] });
});
