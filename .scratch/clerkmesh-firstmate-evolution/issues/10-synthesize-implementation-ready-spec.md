# 汇总可实施规格与分阶段路线

Type: grilling
Status: resolved
Blocked by: 09

## Question

如何把所有已解决决策汇总成不重复决策详情但可直接交接的产品与架构规格，并划分最小垂直切片、验证关口、兼容策略、风险和后续阶段，使实施团队无需再解决首版前置产品或架构问题？

## Answer

根目录 [`IMPLEMENTATION_SPEC.md`](../../../IMPLEMENTATION_SPEC.md) 是 V1 唯一实施入口。它用稳定 requirement ID 固化产品、组件、状态所有权、CLI/API、兼容和安全契约，并链接各前置 Ticket 保留决策推导。

实施严格按 `Gate 0 → Slice 1–5 → Release Gate` 验收：先消除 provenance、canonical path、local-only startup 与 Pi holder 单写锁风险，再依次交付 Web Conversation、Agent Clerk execution、本地 Project delivery、真人 Clerk 和 Learning review 垂直闭环。后阶段不得绕过失败前置；可并行准备独立工作，但不能提前集成或宣称完成。

V1 只认证 macOS 15+ Apple Silicon。自动化测试之外必须使用真实 Pi、Herdr、Treehouse 与 Git 认证关键边界。Slice 4/5 由实施 Agent 在隔离 fixture 中充当测试 Captain 并保存证据，不阻塞夜间执行；全部 Gate 通过后只形成 Release Candidate，次日由 Captain 集中完成一次真人 Clerk、Learning diff 与最终发布验收。

兼容承诺只覆盖最终 vendored Firstmate provenance commit 的既有行为与发布后的 v1 schemas，不迁移任意既有 Firstmate Home 或预发布格式。规格同时定义 fail-closed blocker、风险控制、自主修复/升级协议、requirement-to-test evidence 和最终交接产物，因此实施团队不需要重新解决 V1 前置产品或架构决策。
