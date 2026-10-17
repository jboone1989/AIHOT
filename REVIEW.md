# 审查说明

只给代码审查用（Claude 的 PR 审查、本地 `/code-review`、`@claude` 复审）。项目约定在 `AGENTS.md`，违反它的改动按影响定级。

## 这个仓库里“出问题”长什么样

- **生产部署出错**：`scripts/deploy-prod.sh`、`docker-compose*.yml`、`Dockerfile`、`config/environments/` 的改动让 VM09 构建错镜像、起不来、重建了 PostgreSQL 或 Neo4j，或者跳过了 smoke。`43.133.185.154` 是 Ferro 的机器，任何指向它的部署配置都是 Important。
- **数据被毁**：迁移改了已发布文件、整表重写、非 `CONCURRENTLY` 建索引、删列或删表后旧镜像回滚会挂；任何 `down -v` 或会清空 volume 的命令。
- **花钱或泄密**：模型调用绕开 `providers/receipts.ts` 和预算熔断；安全阀（`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`FEISHU_*_ENABLED`、`INDEXNOW_SUBMIT_ENABLED`）默认值变成开；密钥、`.env` 内容、管理员会话出现在前端、日志、公开接口或提交里。
- **公开出口读错数据**：公开页面、RSS、API、MCP 没走 `packages/backend/src/publication/`；读者请求触发了模型调用；后台接口没校验管理员。
- **长任务放在 HTTP 请求里**：批量、逐个 `await` 的循环、要跑几分钟的事放在 API 路由里，而不是 worker 的任务里。

## Important 的标准

只有会让上面这些发生的问题才算 Important：逻辑错误、数据丢失、钱或密钥泄露、部署或回滚走不通。命名、风格、重构建议最多算 Nit。

## Nit 最多 3 条

## 不报告

- CI 已经检查的：类型错误、迁移安全检查、测试失败、格式
- `package-lock.json`、`docs/*.json` 里的审计数据、`assets/` 和 `docs/assets/` 里的图片
- 只在 `tests/` 里为了测试故意违反生产规则的写法
- `docs/` 下的文字润色

## 证据

- 关于行为的结论要给出源码里的 `文件:行号`，不能只凭函数名推测。
- 不是这个 PR 引入的旧问题标成 Pre-existing，不算作者的。
- 同一类问题在多处出现时，说清是哪一类，列出所有位置，让作者一次改完。

## 复审

- 第二轮起只看新的 diff，已经发过的问题不重复。
- 同一个 PR 审到第三轮还在出新问题，停下来建议作者重新考虑做法，不再逐行挑。

## 总结的写法

总结第一句是数字：“Important 2 条，Nit 1 条”。没有要改的就直接写“没有要改的”。

## 出过的事故

每次线上出问题，在这里加一条：哪个改动、哪里坏了、本该怎么拦住。审查时对照检查同类问题。

- #33–#36（2026-10）：生产发布连续修了四次。部署脚本按 checkout 的 HEAD 而不是镜像实际来源的 commit 判断要不要重建；发布脚本丢了可执行位；`docker-compose.production.yml` 里写进了字面量的 `\n`。凡改 `deploy-prod.sh` 和 compose 文件的 PR，检查它比较的是哪个版本、脚本权限和 YAML 里的转义。
- #44–#46（2026-10）：Provider 批量检测先放在 API 请求里逐个 `await`，留下一半卡在 pending 的批次，之后又改了五六次并发方式。批量任务要在 worker 里一次排进队列，可以从卡住的地方继续。
