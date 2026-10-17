# 改动从写到上线的检查

目标：大部分改动不用逐行读也能安全合并，你的时间只花在高风险改动上；同时回滚率不能上升。做法参考 Claude Code 团队的 [code review 流程](https://claude.dev/blog/solving-code-review-at-anthropic/)，按一个人维护的仓库裁剪过。

## 一个改动经过的几层

| 层 | 在哪 | 拦什么 |
| --- | --- | --- |
| 开 PR 前自查 | `CLAUDE.md`：跑相关检查、贴真实输出，再让新上下文的子 agent 按 `REVIEW.md` 审一遍 | 大部分低级错误 |
| CI | `.github/workflows/check.yml`：迁移安全、类型、构建、网页和后端测试、站点 smoke、Docker 起站 | 能写成检查的一切 |
| Claude 审查 | `review.yml` 的 `claude`：多个 agent 找 bug、验证后按严重程度发行内评论，标准见 `REVIEW.md` | 逻辑错误、违反 `AGENTS.md` 的规则 |
| 安全审查 | `review.yml` 的 `security`，重点见 `.github/security-review.md` | 密钥外泄、绕过预算、后台越权、SSRF |
| 风险分级 | `review.yml` 的 `risk`，规则在 `scripts/pr-risk.ts`，结果是 `risk:*` 标签 | 决定你要花多少时间 |
| 发布 | `scripts/deploy-prod.sh`：cn-dev 构建、按 commit 打 tag、VM09 只换镜像、smoke | 起不来、内容不对 |
| 回滚 | `scripts/rollback-prod.sh`：一条命令换回上一个镜像 | 前面都漏掉的 |

## 按风险决定你花多少时间

- **risk:low**（只动文档、图片、更新日志）：CI 绿、评论都处理了就合。
- **risk:medium**（普通代码）：看 Claude 的总结和 PR 里的验证记录，有 Important 先处理。
- **risk:high**（部署、CI、迁移、登录、计费、审查规则本身）：自己读 diff；改部署的先在 VM09 跑 `bash scripts/deploy-prod.sh --check`；迁移确认能在线执行、回滚时旧代码还能读。

规则只看改了哪些路径，不看作者是谁。要调整就改 `scripts/pr-risk.ts` 和它的测试；先严后松，有证据再放宽。

## 每条审查意见都要有结果

修掉，或者回复理由后 Resolve。在手机上可以直接回复 `@claude 修掉上面的 Important`，它会推一个修复提交。审到第三轮还在出新问题，就停下来想想做法本身。

## 一次性设置

1. 在仓库安装 [Claude GitHub App](https://github.com/apps/claude)。
2. 在仓库 Settings → Secrets and variables → Actions 加 secret：
   - `CLAUDE_CODE_OAUTH_TOKEN`：本机跑 `claude setup-token` 生成，用你的 Claude 订阅额度；或者
   - `ANTHROPIC_API_KEY`：Claude Console 的 API key，按量计费。安全审查只支持这个，没有它 `security` 会跳过。
3. Settings → Branches 给 `main` 加保护规则：要求 PR、要求 `check` 和 `docker` 通过、勾选 **Require conversation resolution before merging**（审查评论没处理完就合不了）。一个人维护时不要勾“需要别人批准”，否则合不了自己的 PR。

没配 secret 时两个 Claude 任务会跳过并留一条提示，不会让 PR 变红。

## 漏掉的问题怎么处理

线上出了问题、或者回滚了一次：

1. 在 `REVIEW.md` 的「出过的事故」加一条：哪个 PR、坏在哪、本该怎么拦。
2. 能写成检查的，加进 CI 或测试；属于高风险路径却被分成 medium 的，改 `scripts/pr-risk.ts`。
3. 问一句“哪一层本该拦住”，修那一层，而不是只修这一个 bug。
