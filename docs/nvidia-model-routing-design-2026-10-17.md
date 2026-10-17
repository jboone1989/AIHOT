# NVIDIA 官方 81 模型：开发环境核对及分层路由

日期 2026-10-17。范围仅 cn-dev；未启用生产自动分发。模型出现在 NVIDIA API 目录中，不代表当前账号能调用其托管端点。

## 官方资料与可审计文件

- LLM API 官方索引：https://docs.api.nvidia.com/nim/reference/llm-apis
- 视觉 API 官方索引：https://docs.api.nvidia.com/nim/reference/visual-models-apis
- 检索 API 官方索引：https://docs.api.nvidia.com/nim/reference/retrieval-apis
- 81 行逐模型索引匹配、能力和历史证据：nvidia-model-official-crosscheck.json
- 首轮 81/81 API 证据：nvidia-model-audit-2026-10-17.json
- 12 个慢模型官方参数复测：nvidia-slow-model-recheck-2026-10-17.json

精确 ID 对照：17 个有已核对的模型级官方文档；16 个另外匹配当前官方 API 类别索引；48 个未在这三份索引中找到完全相同的 ID。后者代表「当前索引无精确条目」，不代表没有开源权重或不能自行部署。

## 模型族和正确请求

| 专用能力 | 典型模型 | 请求范式 | 网站适用 |
|---|---|---|---|
| 基础文本 | openai/gpt-oss-20b | Chat Completions，reasoning_effort=low | 新闻初筛，实体初提，短摘要 |
| 中级推理 | nvidia/nemotron-3.5-lightning-30b-a3b | Chat、reasoning_budget、SSE 至 [DONE] | 关系判断，事件归组 |
| 深度推理 | nvidia/nemotron-3-super-120b-a12b，z-ai/glm-5.3 | Chat、足够推理 tokens，长任务预算 | 冲突复核，研究综述 |
| 视觉理解 | meta/llama-3.2-11b-vision-instruct，nvidia/nemotron-3.5-super-vl-120b-a12b | Chat 的 image_url，独立实图验证 | 图片解说，图表复核 |
| 文本向量 | nvidia/nemotron-3-embed-1b | /v1/embeddings，passage/query | 文章语义索引，Graphiti |
| 多模态向量 | nvidia/llama-nemotron-embed-vl-1b-v2 | /v1/embeddings，图片文档分别验证 | 图表+文字联合检索 |
| 安全检测 | nvidia/nemotron-3.5-content-safety | 官方标签分类格式，不是通用聊天 | 内容安全及后台审核 |
| 翻译 | nvidia/riva-translate-4b-instruct-v2 | Chat，专门评估双语准确性 | 中英文网站内容 |
| 编程 | poolside/laguna-xs-2.1 | Chat，代码专项测试 | Agent 工具及代码 |
| 文档解析 | nvidia/nemotron-parse-2.0 | 1024×1280 以上 RGB 图，格式控制 tokens | 财报及 PDF（未通过内容提取验收） |

DiffusionGemma 的 diffusion 并非图像生成输出：官方提供 Chat Completions，开发请求返回文本。Embedding 两个实测 2048 维模型不能仅因维度一样就替换现有向量索引：向量空间仍须重建或隔离。

## 为什么固定 18 秒错误

开发实测的一次成功调用耗时：Lightning 11.8 秒、Nemotron 3 Super 13.7 秒、Gemma 4 31B 27.4 秒、GLM 5.3 Flash 72.5 秒、GLM 5.3 123.3 秒、Super VL 3.7 秒。这不是 p95 分布，只能表明各模型延迟显著不同。

交互轻任务、离线批处理、复杂推理应有不同的首 token / 全响应 deadline；长模型可用 120–180 秒或更长的可配置离线预算。SSE 读取至 [DONE]；区分 reasoning 与最后正文；HTTP 200 空响应不是合格推理；HTTP 202 进入结果轮询，超时不是永久不可用，404 是当前端点或账号失败。

## 网站的两层能力模型池

第一层 **能力**：文本、推理、视觉、文档、文本 Embedding、多模态 Embedding、内容安全、翻译、编码、其它专用类型分别验证。第二层 **任务难度和成本**：轻任务优先已验证低成本模型，中任务选已验证推理模型，重任务只调用在网站任务基准上比轻模型明显更好的模型；加入观测到的质量分数、p95 耗时、成本、熔断状态。

实现文件：packages/backend/src/providers/nvidia-task-selection.ts；回归测试：tests/nvidia-task-selection.standalone.test.ts 和 tests/nvidia-official-manifest.standalone.test.ts。该模块为开发策略，未改变生产模型池的默认路由。

## 生产准入条件

1. 取得官方模型级示例（或明确标记目前没有），按同一模型 ID、端点、示例参数调用。
2. 分别验证 HTTP 接收、非空有效结果、真实模态输入、应用业务正确性。
3. 用同一套新闻过滤、实体识别、事件归组、长文综述及翻译用例评价每个候选；模型大不自动代表更准确。
4. 按五个不同指标展示：目录数量、官方文档匹配、接口响应成功、任务质量达标、生产准入数量。
5. 默认不开启新生产路由；通过开发预览、真实任务评测后再渐进发布。保留所有 81 个历史模型及证据，不因为 404/超时删除模型。

**边界：**这次无法把当前官方索引未列出的 48 个模型说成按官方示例已验证。它们的专属模型页、已下架状态或自部署路径必须单独证实；不能靠猜测参数得出“多数都可用”。
