# LivingRuntime 网站知识网络体验

## 目标与原则

保留 AIHot 的采集、去重、事件树、热度榜、日报与报道时间线；阅读体验从单纯浏览信息流调整为 **事件 → 实体关系 → 来源证据**。Graphiti/Neo4j 是唯一长期图谱引擎，前端只展示其已有的关系，绝不因两条新闻同时提到实体就自行连线。LlamaIndex / Ferro 客户端不参与本次网站改版。

## 当前页面

- `/`：顶部一行是过去 24 小时的采集、精选数和图谱规模；主视觉是热度第一的事件，右边是它在图谱里的关系和一条证据（没有热点时显示图谱最新关系）；下面是热度 2–5 名和信息流，宽屏右栏是行情（浏览器读 `/api/market/spot`）、最新日报和接入方式。筛选后隐藏顶部和主视觉。
- `/hot`：原有事件聚类/热度排序继续保留；顶部一行说明事件、关系、证据三层，并链接知识网络。
- `/knowledge`：关系探索工作台。读取 `/api/site/knowledge/overview` 的 Graphiti 关系样本，渲染实体连线与关系列表；点击列表高亮当前关系，点击节点打开实体档案；可本地按实体、关系和事实文本筛选。
- `/knowledge/entity/:key`：特定 Neo4j 实体的连接关系，支持从该实体追踪更多事实来源。
- `/story/:publicId`：保留原事件进展、时间线和热度，替换原先的纯文本关系卡为独立关系网络与证据抽屉（列表联动）。
- 桌面侧边栏、移动端 TabBar、更多工具页新增明确的知识网络入口。

## 数据边界

- `GET /api/site/knowledge/stats`：已入图报道、实体数、关系数；不统计数据库中未入图的所有新闻。
- `GET /api/site/knowledge/overview`：Graphiti 最近的 **至多 64 条关系样本**；并非完整知识库或“最重要”的全量排名。筛选框只筛选这个样本，不发起模型推理。
- `GET /api/site/knowledge/stories/:publicId`：通过 PostgreSQL 事件归组找到文章修订版，再获取 Graphiti 对应的实体关系。
- `GET /api/site/knowledge/entities/:key`：围绕单个 Neo4j 实体查询；节点仅在已经具有关系时被连线展示。
- 来源区展示 Graphiti 提取事实的陈述，**并不标记为原文逐字引述**；用户可点击原始 URL 核实。已失效关系显示 `invalidAt`。
- Graphiti 不可用时展示说明，不阻断 AIHot 事件树页面或新闻列表。

## 验收

```sh
npm run typecheck
node scripts/knowledge-ui-smoke.mjs
# 浏览器二进制存在时才运行交互/响应式验收：
node scripts/knowledge-ui-browser-check.mjs
```

不要把首页图谱缩略图误称作全库数据，不要提前承诺跨事件关系必然存在；关系只由新闻证据产生。前端不得持有 Neo4j 密码或 NVIDIA API 密钥。
