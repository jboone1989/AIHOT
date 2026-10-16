// Following and the per-topic/per-entity feeds: an entity takes the public reports its Graphiti relations
// cite, never a withdrawn one; unknown follows are left out.
import './setup.ts';
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { sql, closeDb } from '@aihot/backend/db';
import { followingItems, followList } from '@aihot/backend/publication/following';
import { entityFeed, topicFeed } from '@aihot/backend/publication/feeds';

const ENTITY = 'ent-follow-1';
let server: http.Server;

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === `/entities/${ENTITY}`) {
      const evidence = (articleId: string) => ({ articleId, url: '', source: 'src', quote: 'fact', publishedAt: null });
      return res.end(JSON.stringify({
        entity: { key: ENTITY, name: 'Follow Labs', kind: 'entity' },
        edges: [{ id: 'e1', subject: { key: ENTITY, name: 'Follow Labs', kind: 'entity' }, predicate: 'RELEASED', object: { key: 'x', name: 'Model X', kind: 'entity' },
          fact: 'Follow Labs released Model X', validAt: null, invalidAt: null, evidence: [evidence('fo-public'), evidence('fo-withdrawn')] }],
      }));
    }
    res.end(JSON.stringify({ entity: null, edges: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.GRAPHITI_API_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode,next_fetch_at) VALUES ('following','Following Wire','rss','T2','editorial','2100-01-01')`;
  for (const [id, hoursAgo] of [['fo-public', 1], ['fo-withdrawn', 2]] as const) {
    const at = new Date(Date.now() - hoursAgo * 3600_000);
    await sql`INSERT INTO articles (id,source_id,identity_key,url,title,discovered_at,timeline_at)
      VALUES (${id},'following',${id},${'https://example.org/' + id},${id},${at},${at})`;
    await sql`INSERT INTO publications (article_id,source_id,title,url,timeline_at,discovered_at,sort_at,body_mode,eligible,channel)
      VALUES (${id},'following',${'Report ' + id},${'https://example.org/' + id},${at},${at},${at},'summary',true,'news')`;
  }
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = 'fo-withdrawn'`;
});

after(async () => {
  delete process.env.GRAPHITI_API_URL;
  server.close();
  await closeDb();
});

test('a follow list keeps known shapes, once each, up to its limit', () => {
  assert.deepEqual(followList('openai, bad slug!,openai,nvidia', 30, /^[a-z0-9-]{1,60}$/), ['openai', 'nvidia']);
  assert.deepEqual(followList('a,b,c', 2, /^[a-z]$/), ['a', 'b']);
  assert.deepEqual(followList(undefined, 5, /./), []);
});

test('following an entity lists its public cited reports and names the follow', async () => {
  const res = await followingItems(['no-such-topic'], [ENTITY, 'unknown-entity']);
  assert.deepEqual(res.items.map((i) => i.id), ['fo-public'], 'the withdrawn report is left out');
  assert.deepEqual(res.items[0]!.via, ['Follow Labs']);
  assert.equal(res.items[0]!.source.tier, 'media', 'cards carry the source tier');
  assert.deepEqual(res.follows, { topics: [], entities: [{ key: ENTITY, name: 'Follow Labs' }] });
});

test('topic and entity feeds: unknown ones are null, known ones carry only public reports', async () => {
  assert.equal(await topicFeed('no-such-topic'), null);
  assert.equal(await entityFeed('unknown-entity'), null);
  const xml = (await entityFeed(ENTITY))!;
  assert.match(xml, /<title>[^<]*Follow Labs<\/title>/);
  assert.match(xml, /<guid isPermaLink="false">fo-public<\/guid>/);
  assert.doesNotMatch(xml, /fo-withdrawn/);
  assert.match((await topicFeed('openai'))!, /<atom:link href="[^"]*\/feed\/topic\/openai\.xml"/);
});
