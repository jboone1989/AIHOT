# AIHot → Ferro：单一公共资讯源

## 本次迁移范围（2026-10-14）

- AIHot 开发站的 `industry/sources.json` 现有 45 个公开 RSS 采集来源，覆盖 AI、加密货币、宏观金融和影响市场的全球政治、能源及产业事件；包含 Ferro 历史定期读取的 BBC Business 与美联储公告。
- Ferro 的实际固定 RSS 配置只有这两个。历史 `source_registry.json` 出现的 256 个域名来自自主网页搜索的发现记录，**不是** 256 个订阅源；不能照单迁移，其中许多属于一次性搜索命中、镜像或无关网站。
- Ferro 的研究型网页搜索、GitHub/X 观察，以及 OKX/Binance 行情与链上数据，属于不同能力；此次只统一 *周期性新闻采集*，不伪装成已经转移市场数据接口。

## 数据边界

AIHot 自行采集 RSS、过滤与归组，公开通过 `GET /api/v1/items?mode=selected&window=7d&by=published&limit=100` 提供近期精选。网站数据中保留原始来源 `links.original`。

Ferro 侧 `src/wechat_traffic_agent/site_news.py` 从上述 API 获取候选资讯，保留原始出处和网站文章 ID；它仍对研究所需的完整原文与数据独立求证，但无需再维护 RSS 名单。

## 实际切换顺序

1. 在 AIHot 部署目标环境检查 `industry/sources.json`，构建、迁移数据库。
2. 一次性执行 `node --env-file=.env scripts/sync-news-sources.ts`：同步已存在的隔离信源，禁用旧的 `ferro` RSS 来源（保留历史文章）。
3. 启动并确认 API 有新的 `selected` 内容和原始来源链接；在内容处理尚未开启的环境，不能仅凭 200 响应断言可用。
4. 为 Ferro 设置 `CONTENT_NEWS_AGGREGATOR_URL=https://<实际 AIHot 站点域名>`，同时清空 `CONTENT_NEWS_FEEDS`。这时 Ferro 自动走 AIHot，不再抓固定 RSS。避免把开发 localhost 配置填到远程生产主机。
5. 使用真实资讯和一次 Ferro 消费日志验证，然后才下线旧 RSS 配置。切换前生产 Ferro 维持旧入口，避免站点尚未可用时断粮。

## 约束

- `seed.ts` 是新增不覆盖；`sync-news-sources.ts` 仅在明确切换时执行一次，后续后台改动不会在每次启动时被重置。
- RSS 数量是配置数量，不等于所有源都已验证可达、完成采集或获得精选。
- 来源摘要不是原始证据。Ferro 要论证具体数据时仍应追溯研究报告、公告或原始数据。
- 下一阶段可在 AIHot 增加市场数据接口，再逐项迁出 Ferro 的 OKX/Binance 数据采集；本轮尚未迁移。

## 2026-10-14 扩展：结构化市场快照

AIHot API 新增 `GET /api/market/spot?asset=BTC`（亦支持 ETH、SOL、XRP、BNB），并从 **Binance 和 OKX** 分别获取现货 USDT 对的最新价格、24 小时价格涨跌百分比、24 小时计价货币成交额、交易所数据时间以及原始 API URL。每资产缓存 60 秒，部分交易所故障显示部分结果，不猜测缺失数字。两所行情不得当成同一个平均成交量，也不得把 24 小时成交额写成“净流入”。

Ferro 的 `collect_okx_public_market` 在配置 `CONTENT_NEWS_AGGREGATOR_URL` 后读上述 AIHot 接口；其他 Binance 合约持仓、资金费率、Web3 数据尚未迁移，不能提前删除原采集能力。这里是只读快照，**没有持久化时间序列、衍生品全量接口或行情与新闻的因果自动判断**。

## 全球事件与数据公告

配置扩展到 45 个公开 RSS 来源，新增 BLS 的 CPI、就业、JOLTS、PPI，ECB 公告与数据、EIA 能源、BBC 全球与政治新闻。公共编辑预筛只纳入有清晰金融、产业或技术传导路径的重大政治、军事和供应链事件，不把一般社会新闻整站搬运。长鑫芯片进展→存储竞争预期→韩股波动是多因素案例；时间同现不等于单一因果。后续需要建设真正的宏观发布时间表、指标历史与公布值/预期值/前值，而不把 RSS 文章当作数字数据库。

## 研究历史检索（不建因果影响树）

AIHot 已留存文章原始 URL、时间、公开发布情况、事件归组和事件综述历史。新增可供 Ferro、其他 Agent 使用的**跨来源历史检索**；并不自动判断事件之间存在因果关系。

- 过去 90 天的公开报道：`GET /api/v1/items?mode=all&q=semiconductor&window=90d&by=published&limit=20`
- 过去一年某主题：`GET /api/v1/items?mode=all&q=stablecoin&window=365d&by=published&limit=20`
- 供智能体直接阅读：`GET /api/v1/agent/search?q=chip&window=365d`；MCP 的 `search` 也支持 30d/90d/365d。
- 7d 范围仍可不带关键词浏览；超过 7 天的查询必须有主题关键词。分页用接口返回的 cursor，旧数据不因移动的检索窗口而永久保证可查；被撤稿或禁止公开的资料不进入搜索结果。

Ferro 的 `GoalEvidenceExplorer.search_web` 在 `CONTENT_NEWS_AGGREGATOR_URL` 已配置时，将网站历史线索与实时网络检索组合，保留原文出处及版本指纹。公开摘要只是研究线索，是否构成证据需继续查官方文档、论文或原始数据。

这里支持**事后查证**，不承诺能预见萨拉热窝式远期连锁反应，不生成自动因果树、不自动把市场波动归咎于新闻。未来研究结论是否值得建立因果链由 Ferro 的独立研究决定。
