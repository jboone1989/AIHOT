# EventGraph Analytics · 数据反馈闭环

**目标**：了解访问 → 事件阅读 → Graph/证据探索 → 来源阅读的真实使用情况。默认使用站内匿名事件统计，Cloudflare、PostHog、Google Search Console 是可选外部数据源。

## 看板

登录后台访问 `/admin/analytics`。显示最近 30 天的 PV、匿名会话、事件阅读、Graph 节点选择、来源跳转、搜索、按天趋势、内容排行、语言和来源域名，以及客户端导航 P75。**该站内会话数不是 UV**；真实独立访客请看 Cloudflare。七天「有效知识探索」定义为：同一匿名标签页会话内至少打开一次事件，并选择至少一个 Graph 节点或访问原文。它衡量的是有效探索会话，而不是经身份确认的独立用户。

- `page_view` 浏览公共页面；管理员页面不记录
- `story_open` / `item_open` 打开事件 / 报道
- `graph_node_select` / `graph_relation_select` 点击实体或选择关系
- `source_open` 点击带来源标记的原文链接
- `search_submit` 搜索动作（不记录搜索词）
- `navigation_complete` 客户端页面跳转耗时（ms）
- `agent_access_open` / `feedback_open` 打开接入或反馈页面

后台查询通过现有 `/api/admin/*` 身份校验。访客匿名事件由 `POST /api/analytics/events` 接收并写入 `product_analytics_events`，不记录 IP、User-Agent、邮箱、全文 URL、查询参数或搜索词；随机会话 UUID 存在 `sessionStorage`。DNT/GPC 浏览器不上传。事件入口限制字段、请求来源和频次；数据按约 90 天周期清理（依靠入库触发机会性清理，低流量场景请另外调度删除维护任务）。

## 外部平台（可选）

1. **Cloudflare Web Analytics**：Cloudflare 控制台将网站添加到 Web Analytics，复制公开 site token 到环境变量 `CLOUDFLARE_WEB_ANALYTICS_TOKEN`。若 Cloudflare 已为此域名自动注入 Beacon，避免重复接入。
2. **PostHog**：创建项目并复制公开的 `phc_...` project token 到 `POSTHOG_PROJECT_TOKEN`，区域通过 `POSTHOG_REGION=us|eu` 设置。本代码只发送有限的匿名关键事件到 PostHog 公共 Capture API，不集成 session replay / autocapture，也不发送用户输入。
3. **Google Search Console**：建议使用 Cloudflare DNS 验证域名；也可复制 HTML 验证字符串到 `GOOGLE_SITE_VERIFICATION`，前台自动生成 `<meta name="google-site-verification" ...>`。验证成功后在 Search Console 查看曝光、关键词、CTR 与索引情况。

三个令牌都由站点所有者在对应平台领取；它们是公开的站点/项目标识，**不要填私有 API key**。这些设置只传入 Web 容器（Docker Compose 的 web.environment）；未配置就不加载对应代码，站内匿名统计不受影响。

## 开通顺序与校验

在开发或生产环境，先备份数据库并完成 `scripts/migrate.ts` 的 0087/0088 迁移，然后同时启动更新的 API 和 Web；只更新 Web 不会启用入库端点。打开前台并点击一篇事件、Graph 节点和原文，后台 `/admin/analytics` 应在刷新后出现行为记录。匿名事件 API 返回 204，非法字段返回 400，跨域事件返回 403。

在浏览器网络面板验证 `/api/analytics/events`，在后台确认非零事件计数。若配置外部平台，在其管理页面确认站点状态和访问数据。**代码提交 / 部署 ≠ 第三方账号已启用，也不表示已有历史流量。**

## 每周改进

每周固定对照：访客/自然搜索趋势、访问→事件→Graph/来源转化、中文/英文差异、热门事件与切换 P75。一次只调整一个高优先级问题，记录改版日期与基线，隔周对照数据；数据不足时不下结论。不要为了追求 PV 人为刷事件。
