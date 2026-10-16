# LivingRuntime 网站知识网络体验

## 目标与原则

保留 AIHot 的采集、去重、事件树、热度榜、日报与报道时间线；阅读体验从单纯浏览信息流调整为 **事件 → 实体关系 → 来源证据**。Graphiti/Neo4j 是唯一长期图谱引擎，前端只展示其已有的关系，绝不因两条新闻同时提到实体就自行连线。LlamaIndex / Ferro 客户端不参与本次网站改版。

## 当前页面

- `/`：顶部一行是过去 24 小时的采集、精选数和图谱规模；主视觉是热度第一的事件，右边是它在图谱里的关系和一条证据（没有热点时显示图谱最新关系）；下面是热度 2–5 名和信息流，宽屏右栏是行情（浏览器读 `/api/market/spot`）、最新日报和接入方式。筛选后隐藏顶部和主视觉。
- `/hot`：原有事件聚类/热度排序继续保留；顶部一行说明事件、关系、证据三层，并链接知识网络。
- `/knowledge`：关系探索工作台。读取 `/api/site/knowledge/overview` 的 Graphiti 关系样本，渲染实体连线与关系列表；点击列表高亮当前关系，点击节点打开实体档案；可本地按实体、关系和事实文本筛选。
- `/knowledge/entity/:key`：实体档案。显示 Graphiti 的实体摘要（有的话）、关系网络、按生效时间排列的关系变化（标出已失效的关系），以及这些关系引用的公开报道和它们所属的事件。有关系的实体允许搜索引擎收录，没有关系的不收录。
- 关注：主题页和实体档案页有“关注”按钮和各自的 RSS（`/feed/topic/<slug>.xml`、`/feed/entity/<key>.xml`）。关注列表只存在读者浏览器里（`eventgraph-follows`，最多 50 个，随“我的收藏”一起导出导入）；首页信息流可切到“我关注的”，读 `/api/site/following`。
- 日报：`/daily` 和 `/daily/:key` 的末尾是“图谱今日变化”，统计本期时间窗口里 Graphiti 新增、失效的关系和第一次出现的实体，附几条有公开报道支撑的例子。规则统计，不调用模型。
- `/story/:publicId`：保留原事件进展、时间线和热度，替换原先的纯文本关系卡为独立关系网络与证据抽屉（列表联动）。
- 桌面侧边栏、移动端 TabBar、更多工具页新增明确的知识网络入口。

## 数据边界

- `GET /api/site/knowledge/stats`：已入图报道、实体数、关系数；不统计数据库中未入图的所有新闻。
- `GET /api/site/knowledge/overview`：Graphiti 最近的 **至多 64 条关系样本**；并非完整知识库或“最重要”的全量排名。筛选框只筛选这个样本，不发起模型推理。
- `GET /api/site/knowledge/stories/:publicId`：通过 PostgreSQL 事件归组找到文章修订版，再获取 Graphiti 对应的实体关系。
- `GET /api/site/knowledge/entities/:key`：围绕单个 Neo4j 实体查询；节点仅在已经具有关系时被连线展示。返回里另有 `reports` 和 `stories`：关系证据引用的报道中，现在仍公开的那些，以及它们所属的事件（`publication/knowledge.ts`）。
- `GET /api/site/following?topics=<slug,…>&entities=<key,…>`：主题最多 30 个、实体最多 20 个，返回最近 40 篇报道和每篇来自哪个关注（`via`）。服务端不存关注列表，同样的列表得到同样的回答，可以公共缓存。
- `GET /api/site/knowledge/daily/:key`：日报本期窗口（`reports.window_start`–`window_end`）内的图谱变化，按 Graphiti 记下变化的时间（关系的 `created_at`、`expired_at`，实体的 `created_at`）统计，不按事实本身的日期。数字是图谱的总数；例子只列出引用了现在仍公开的报道的关系。需要部署新版 knowledge_service（`/changes`）。
- 来源区展示 Graphiti 提取事实的陈述，**并不标记为原文逐字引述**；用户可点击原始 URL 核实。已失效关系显示 `invalidAt`。
- Graphiti 不可用时展示说明，不阻断 AIHot 事件树页面或新闻列表。

## 验收

```sh
npm run typecheck
E2E_BASE_URL=http://127.0.0.1:3000 npm run e2e -- knowledge.spec.ts pages.spec.ts
```

图谱为空时（CI 没有 Graphiti），画图和实体页两项会标为跳过；指向有图谱数据的开发环境或正式站时才会真正跑（`docs/testing.md`）。

不要把首页图谱缩略图误称作全库数据，不要提前承诺跨事件关系必然存在；关系只由新闻证据产生。前端不得持有 Neo4j 密码或 NVIDIA API 密钥。
