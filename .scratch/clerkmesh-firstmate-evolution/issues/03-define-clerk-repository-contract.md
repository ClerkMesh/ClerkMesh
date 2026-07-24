# 定义 Clerk 仓库与 CLERK.md 契约

Type: grilling
Status: resolved

## Question

一个统一 Clerk 模型的本地 Git 仓库应采用什么固定结构、Skill 风格 frontmatter、正文段落、版本语义、能力与排除范围表达、执行方式字段、Skills/脚本批准规则和有界能力卡片投影，才能支持可靠选择与长期演进？

## Answer

采用统一、严格校验、Git 版本化的 Clerk 仓库契约。

### 身份入口

每个 Clerk 位于独立本地 Git 仓库 `clerks/<name>/`，入口为 `CLERK.md`。必填 frontmatter 只有：

```yaml
---
name: product-alice
description: >-
  负责产品需求澄清、用户流程和验收标准；
  不承担代码实现。
execution: human
---
```

- `name` 是不可变机器标识，只允许小写字母、数字与连字符，并必须等于目录名。
- `description` 是候选索引摘要，必须同时概括主要能力和关键排除项；去除首尾空白后非空，最大 1024 UTF-8 bytes。
- `execution` 只能是 `human` 或 `agent`。
- 不设置 `version`、`origin`、Project 权限、技能标签或真人绑定字段。
- 未知 frontmatter 字段校验失败；正式扩展必须同步升级 CLI 契约。

### 固定正文

`CLERK.md` 必须包含且不得重复以下六节：

1. `Role`：组织职责与最终负责内容。
2. `Capabilities`：可独立完成的任务及成立条件。
3. `Boundaries`：不能处理、必须升级或必须拆分的工作。
4. `Working Style`：处理、沟通、判断与交付方式。
5. `Instructions`：执行时必须遵守的优先规则。
6. `Context`：面向 Agent 的渐进披露导航说明。

真人与 Agent Clerk 使用同一结构；真人 Clerk 的执行约束不会被当作 Worker prompt。整个 `CLERK.md` 最大 32 KiB，详细资料必须下沉到子目录。

### 仓库结构

```text
clerks/<name>/
├── CLERK.md
├── workflows/   # 可复用的问题解决流程
├── knowledge/   # 事实、规则、领域资料
├── cases/       # 代表性案例及经验
├── skills/      # Skill 风格能力包及其辅助脚本
└── sources/     # 原始聊天、文档与历史任务证据
```

只有 `CLERK.md` 创建时必需，其余目录按需创建。`workflows/`、`knowledge/`、`cases/` 下每份可检索 Markdown 必须具有 `name` 与 `description` frontmatter；目录 `README.md` 可用于导航但不作为记忆条目。`skills/<name>/SKILL.md` 沿用现有 Skill 格式。`sources/` 不要求统一内容格式且永远不默认进入 Worker 检索范围。

`Context` 不是权限白名单。CLI 固定索引三个可检索资料目录与 `skills/*/SKILL.md`，并固定排除 `sources/`，避免遗漏一条 Markdown 链接就使资料不可用。

### 选择时的渐进披露

1. 全量候选索引只加载 `name`、`description`、`execution` 和内部 Git commit。
2. Firstmate 形成短名单后，才读取候选的 `Role`、`Capabilities` 与 `Boundaries`。
3. Clerk 已选定后，才使用 `Working Style`、`Instructions` 与 `Context` 准备任务上下文。

不生成第二份需要同步维护的能力卡文件。

### 版本语义

Git commit SHA 是唯一权威版本，用户不需要理解或输入它。Web 使用更新时间、变更摘要和“本次执行所用版本”等自然语言展示，SHA 只出现在技术详情与诊断记录中。

- 已提交的默认分支 `HEAD` 是最新批准版本。
- 未提交或暂存内容不参与选择、上下文或检索；仓库 dirty 时仍可按旧 commit 使用，并显示待审核改动。
- 每次执行生成的 brief 记录所选 Clerk 名称和完整 commit SHA。
- 当前 Worker 与其 follow-up 继续使用同一 brief 和 Clerk 版本；后续新 Worker 执行可由 Primary 重新选择当时最合适的 Clerk 与版本并重新生成 brief。
- CLI 为当前执行从 brief 指定的 commit 读取，不能回退到当前工作区文件。
- Clerk 仓库历史不得改写；历史对象缺失时明确失败，不能悄悄使用最新版。
- 不增加用户可见 revision、手工版本号、tag 或额外版本映射。

### 可执行内容边界

- 只有 `skills/<skill-name>/` 中、被对应 `SKILL.md` 明确引用的脚本属于可执行能力。
- 其他目录中的代码块永远只是内容。
- Captain 审核并提交包含脚本的 diff，代表批准该版本。
- 首版拒绝 symlink、Git submodule 和逃出 Clerk 仓库的路径。
- Clerk 内容不能扩大 Worker、Project 或运行工具原有权限。

### 注册与生命周期

`clerkmesh-data/clerks.md` 是薄注册表，只记录 Clerk 名称、本地仓库路径、`active | archived` 状态和是否内置；不复制能力、执行方式或知识。它属于 ClerkMesh，不进入 Firstmate `data/`；只有 active Clerk 进入新任务候选索引。

普通 Clerk 只归档、不日常硬删除；仓库和历史保留，同名永远不能复用。内置 `clerks/escalation/` 使用相同仓库结构，但不可删除、不可归档、不可改为 Agent 执行，也不能被视为专业能力匹配成功。请求无法完整匹配或安全拆分时，Primary 先在对话中说明并请 Captain 补充；只有 Captain 明确选择亲自处理时，Primary 才为该次执行选择 Escalation Clerk。

`clerk validate` 对上述 schema、固定段落、大小、相对路径、禁止对象和目录内容规则进行严格校验，任何违规都停止使用新版本。
