// A daily issue's graph changes: asked for the issue's own window, counts as Graphiti gives them, and
// examples only with a report that is public now.
import './setup.ts';
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { sql, closeDb } from '@aihot/backend/db';
import { dailyGraphChanges } from '@aihot/backend/publication/knowledge';

let server: http.Server;
let asked: URLSearchParams | null = null;
const edge = (id: string, articleId: string) => ({
  id, subject: { key: 'a', name: 'Alpha', kind: 'entity' }, predicate: 'ACQUIRED', object: { key: 'b', name: 'Beta', kind: 'entity' },
  fact: `fact ${id}`, validAt: null, invalidAt: null, evidence: [{ articleId, url: '', source: 's', quote: 'q', publishedAt: null }],
});

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    if (url.pathname === '/changes') asked = url.searchParams;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      added: { count: 7, entities: 2, edges: [edge('e-pub', 'gc-public'), edge('e-gone', 'gc-withdrawn')] },
      ended: { count: 1, entities: 2, edges: [edge('e-end', 'gc-public')] },
      newEntities: { count: 3, items: [{ key: 'a', name: 'Alpha' }] },
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.GRAPHITI_API_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode,next_fetch_at) VALUES ('graph-changes','GC Wire','rss','T2','editorial','2100-01-01')`;
  for (const id of ['gc-public', 'gc-withdrawn']) {
    const at = new Date(Date.now() - 3600_000);
    await sql`INSERT INTO articles (id,source_id,identity_key,url,title,discovered_at,timeline_at) VALUES (${id},'graph-changes',${id},${'https://example.org/' + id},${id},${at},${at})`;
    await sql`INSERT INTO publications (article_id,source_id,title,url,timeline_at,discovered_at,sort_at,body_mode,eligible,channel)
      VALUES (${id},'graph-changes',${id},${'https://example.org/' + id},${at},${at},${at},'summary',true,'news')`;
  }
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = 'gc-withdrawn'`;
  await sql`INSERT INTO reports (kind,key,window_start,window_end,content,generated_at,origin)
    VALUES ('daily','2026-10-14','2026-10-13T16:00:00Z','2026-10-14T16:00:00Z','{}'::jsonb,now(),'manual')`;
});

after(async () => {
  delete process.env.GRAPHITI_API_URL;
  server.close();
  await closeDb();
});

test('graph changes follow the issue window and show only publicly sourced examples', async () => {
  assert.equal(await dailyGraphChanges('2026-10-15', new Date()), null, 'no issue, no changes');
  const changes = (await dailyGraphChanges('2026-10-14', new Date()))!;
  assert.equal(asked?.get('since'), '2026-10-13T16:00:00.000Z');
  assert.equal(asked?.get('until'), '2026-10-14T16:00:00.000Z');
  assert.equal(changes.added.count, 7, 'counts are the graph’s own');
  assert.deepEqual(changes.added.edges.map((e) => e.id), ['e-pub'], 'an example backed only by a withdrawn report is left out');
  assert.deepEqual(changes.ended.edges.map((e) => e.id), ['e-end']);
  assert.equal(changes.newEntities.count, 3);
  assert.equal(changes.status, 'ok');
});
