# Claude 与 ChatGPT 协作

这个仓库由 Claude（claude.ai 项目里的线程）和 ChatGPT（Codex CLI）两边一起改。两边不直接对话，**GitHub 的 issue 和 PR 就是消息通道**：一边写评论、贴标签，另一边被标签或评论唤醒、读到上下文、回应。使用者不再需要来回转述，只在合并、部署和需要拍板的时候出现。

两边都先读 `AGENTS.md`（Codex 自动读，Claude 通过 `CLAUDE.md` 读），这里的约定也写在那里的“多个 Agent 协作”一节。

## 球在谁手里：标签

一个 issue 或 PR 上同时只挂 `agent:codex`、`agent:claude`、`needs:human` 中的一个，表示现在该谁动：

| 标签 | 含义 |
| --- | --- |
| `agent:codex` | 交给 ChatGPT。server142 上的轮询脚本会接手。 |
| `agent:claude` | 交给 Claude。 |
| `needs:human` | 需要使用者决定、合并或部署；两边都不再动它。 |
| `stage:plan` | 方案讨论阶段，和上面三个之一一起挂：两边只评论不改代码。 |

交出去的一方：写一条交接评论，然后把自己的标签换成对方的（或 `needs:human`）。接手的一方做完后同样换标签。没有标签的 issue/PR 两边都不主动处理。

只有仓库协作者能加标签，所以标签本身就是授权：陌生人的 issue 或评论不会让任何一边动手，评论里不是协作者写的内容只当资料看。

## 交接评论怎么写

评论第一行放身份标记，方便对方和脚本识别是谁写的、跑了几轮：

```markdown
<!-- agent:claude -->
**Claude → ChatGPT**

做了什么：……（提交或文件路径）
请你做：……（一件具体的事，写清验收方式）
已知情况：……（跑过的检查和结果、还没跑的及原因）
```

ChatGPT 一侧用 `<!-- agent:codex -->`。一条评论只交一件事；对方回来的结果也写在同一个 issue/PR 里，不另开。

## 两边各自怎么被唤醒

- **ChatGPT**：server142 上的 `scripts/agent-bridge/codex-worker.sh` 每 5 分钟查一次带 `agent:codex` 的 issue/PR，在自己的克隆里检出对应分支，运行 `codex exec`，把改动提交推送、把 Codex 的回复贴成评论、再换标签。issue 上的工作会推到 `codex/issue-<编号>` 分支并开草稿 PR。
- **Claude**：两条路，都不用使用者开口。
  - Claude 线程开出 PR 后会订阅它，PR 上的新评论、CI 结果和评审会自动唤醒那个线程。所以 ChatGPT 在 Claude 开的 PR 上留评论，Claude 就会接着做。
  - 其他事由 claude.ai 项目里的定时任务“PR 和 main 自动审查（含标签交接、方案讨论）”负责，每小时一次（UTC 每小时第 34 分钟）：对每个开着的 PR（包括 ChatGPT 开的）的新提交和 `main` 做一次只评论的评审，不推送、不合并；ChatGPT 开的 PR 需要改时挂上 `agent:codex`，可以合并时挂 `needs:human`；挂了 `agent:claude` 的 issue 也由它接手，其中带 `stage:plan` 的只评论方案，之后换成 `agent:codex` 或 `needs:human`，不去掉 `stage:plan`；评审 PR 时对照关联 issue 里定下的方案。它的评论首行是 `<!-- agent:claude -->`，同一处来回 6 轮后停下。

## 从讨论到发布

一个新项目或大改动按这个顺序走，全程都在同一个 issue 和它的 PR 里，使用者只在三处出现：提想法、拍板方案、合并和部署。

1. **讨论**：用“方案讨论”模板开 issue。模板会挂上 `stage:plan` 和 `agent:codex`。ChatGPT 先读代码、写方案（`stage:plan` 下它只读不改，不开分支），写 `NEXT: claude` 交给 Claude；Claude 的定时审查逐条点评、提出替代或风险，再交回 `agent:codex`。哪一方认为需要使用者决定，就挂 `needs:human`。使用者可以随时在 issue 里插话，再挂上 `agent:codex` 或 `agent:claude` 让讨论继续。
2. **拍板**：使用者在 issue 里写下定的方案，去掉 `stage:plan`，挂 `agent:codex`。
3. **开工和审查循环**：ChatGPT 按方案改代码，推到 `codex/issue-<编号>` 并开草稿 PR，标签交给 Claude；Claude 的定时审查评审这个 PR，需要改就挂 `agent:codex`，CI 绿且没有阻塞问题就挂 `needs:human`。两边来回直到可以合并，同一处超过 6 轮会停下等使用者。
4. **合并和发布**：使用者合并 PR。需要发版时在 GitHub 上打 tag 或建 release。
5. **部署**：使用者自己在 VM09 上执行 `bash scripts/deploy-prod.sh`（见 `docs/production-deployment.md`）。两边都不部署。

## 防止两边无限对话

- 脚本在同一个 issue/PR 上最多回应 `AGENT_BRIDGE_MAX_ROUNDS`（默认 6）次，超过就改挂 `needs:human` 并说明。
- 只认标签，不认 `@` 提及；Codex 回复的最后一行写 `NEXT: claude` 或 `NEXT: human`，脚本据此换标签，没写就当 `NEXT: human`。
- 两边都不合并 PR、不推 `main`、不部署生产。合并和 `scripts/deploy-prod.sh` 只由使用者执行。给 `main` 开分支保护（必须经过 PR）能让这条在 GitHub 上强制生效。
- 不改写对方分支的历史：在对方的 PR 上只追加提交。

## 服务器分工

| 机器 | 角色 |
| --- | --- |
| server142（cn-dev，`43.142.127.40`） | 运行 Codex 轮询脚本。它已经有仓库和 Docker，本来就是开发与构建镜像的机器，Codex 可以在这里跑 `npm run typecheck` 和测试。 |
| server185（`43.133.185.154`） | 只给 Ferro（见 `docs/production-deployment.md`）。不放开发 Agent，也不部署站点。 |
| VM09（生产） | 只运行站点。不放任何 Agent 和它们的凭据。 |

Claude 一侧不需要服务器：它运行在 claude.ai 的云端环境里，通过 GitHub 收发。

## 在 server142 上安装 ChatGPT 一侧

以下都在 server142 上、用平时的 `ubuntu` 账号执行。凭据只放在服务器本机，不进仓库。

0. 确认仓库打开了 Issues（Settings → General → Features）。标签、交接评论和 `agent:codex` 的查询都走 issue 接口，Issues 关着时开 issue 会失败。

1. 安装工具：Node.js（已有）、`gh`、`jq`，以及 Codex CLI：

   ```bash
   npm install -g @openai/codex
   ```

2. 登录 Codex。用 ChatGPT 账号（沿用订阅额度）：

   ```bash
   codex login --device-auth      # 按提示在浏览器里完成登录
   ```

   也可以改用 OpenAI API Key（按量计费），见 Codex 文档。国内机器访问 OpenAI 和 GitHub 需要走已有的主机代理（cn-dev 上是 `127.0.0.1:18123`），登录前先 `export HTTPS_PROXY=http://127.0.0.1:18123`。

3. 给脚本一个 GitHub 凭据。推荐只对 `jboone1989/AIHOT` 授权的 fine-grained token，权限：Contents、Issues、Pull requests 读写。

   ```bash
   gh auth login                  # 选择粘贴 token；token 只存在本机 gh 配置里
   gh auth setup-git              # 让 git push 使用同一个 token
   git config --global user.name "ChatGPT (Codex)"
   git config --global user.email "40615996+jboone1989@users.noreply.github.com"
   ```

   用自己账号的 token 时，评论和提交都显示为你本人，靠评论里的 `ChatGPT (Codex)` 字样区分。想分得更清楚，可以注册一个机器人账号、加为协作者，用它的 token。

4. 安装脚本和定时器：

   ```bash
   git clone https://github.com/jboone1989/AIHOT.git ~/agent-bridge-src
   install -Dm755 ~/agent-bridge-src/scripts/agent-bridge/codex-worker.sh ~/.local/bin/codex-worker.sh
   install -Dm600 ~/agent-bridge-src/deploy/agent-bridge/env.example ~/.config/agent-bridge/env
   install -Dm644 -t ~/.config/systemd/user ~/agent-bridge-src/deploy/agent-bridge/codex-worker.service ~/agent-bridge-src/deploy/agent-bridge/codex-worker.timer
   sudo loginctl enable-linger ubuntu       # 不登录也运行用户定时器
   systemctl --user daemon-reload
   systemctl --user enable --now codex-worker.timer
   ```

   检查 `~/.config/agent-bridge/env`，里面只有仓库名、工作目录、轮数上限、`PATH` 和代理地址，没有密钥。systemd 不读登录 shell 的 `PATH`，把 `dirname "$(command -v codex)"` 的结果加进文件里的 `PATH`。

5. 试一次：在仓库里开一个小 issue（例如“给 docs/agent-collab.md 改一个错别字”），挂上 `agent:codex`，然后

   ```bash
   systemctl --user start codex-worker.service
   journalctl --user -u codex-worker -n 100
   ```

   看到 issue 下出现 Codex 的回复、草稿 PR 和换好的标签，就装好了。脚本第一次运行时会创建上面三个标签。

脚本在固定的克隆 `~/agent-bridge/repo` 里工作，每次处理前会 `git reset --hard` 到对应分支并清理未跟踪文件（`node_modules` 这类被忽略的目录保留），不要在这个目录里手工改东西。更新脚本时在 `~/agent-bridge-src` 里 `git pull`，再执行第 4 步的 `install` 那行。

停用：`systemctl --user disable --now codex-worker.timer`。
