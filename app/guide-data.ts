export const SOURCE_COMMIT =
  "d4998d611ad37de0aa9723b6fdd2d9a2f8ff4763";

export const SOURCE_ROOT = `https://github.com/openai/codex/blob/${SOURCE_COMMIT}`;

export type Chapter = {
  id: string;
  number: number;
  eyebrow: string;
  title: string;
  description: string;
  takeaways: string[];
  paths: Array<{ label: string; path: string }>;
};

export const chapters: Chapter[] = [
  {
    id: "repo-overview",
    number: 1,
    eyebrow: "建立坐标系",
    title: "Codex 是什么",
    description:
      "先把它看成一个本地 coding-agent runtime，而不是一个 Node.js 命令行工具。理解产品形态、语言分布和仓库边界。",
    takeaways: [
      "主体实现位于 codex-rs，npm 包只负责找到并启动平台原生二进制。",
      "同一套 runtime 支撑 TUI、非交互 exec、app-server 和 SDK。",
      "阅读架构时必须绑定 commit；这个仓库变化很快。",
    ],
    paths: [
      { label: "项目说明", path: "README.md" },
      { label: "仓库约定", path: "AGENTS.md" },
      { label: "Rust workspace", path: "codex-rs/Cargo.toml" },
    ],
  },
  {
    id: "directory-map",
    number: 2,
    eyebrow: "建立坐标系",
    title: "顶层目录地图",
    description:
      "把 6,000 多个文件压缩成五个区域：产品 runtime、分发入口、SDK、文档，以及开发与发布基础设施。",
    takeaways: [
      "codex-rs 占仓库绝大多数，是日常开发的主战场。",
      "sdk/typescript 与 sdk/python 使用不同的进程集成方式。",
      "scripts、tools、Bazel、Nix 和 justfile 属于开发基础设施，不是 agent runtime。",
    ],
    paths: [
      { label: "npm workspace", path: "pnpm-workspace.yaml" },
      { label: "安装说明", path: "docs/install.md" },
      { label: "任务入口", path: "justfile" },
    ],
  },
  {
    id: "entrypoints",
    number: 3,
    eyebrow: "入口层",
    title: "CLI、TUI、Exec、App Server",
    description:
      "沿着 codex 二进制的分发逻辑，理解无子命令、exec、review 和 app-server 如何进入不同表面。",
    takeaways: [
      "cli/src/main.rs 是所有命令的总路由。",
      "无子命令启动交互 TUI；exec 与 review 进入非交互执行器。",
      "app-server 是 IDE 和进程外客户端的集成边界。",
    ],
    paths: [
      { label: "命令分发", path: "codex-rs/cli/src/main.rs" },
      { label: "TUI 入口", path: "codex-rs/tui/src/lib.rs" },
      { label: "Exec 入口", path: "codex-rs/exec/src/lib.rs" },
    ],
  },
  {
    id: "two-protocols",
    number: 4,
    eyebrow: "边界层",
    title: "两层 Protocol",
    description:
      "区分核心内部的 Op/Event 消息和 app-server 对外 JSON-RPC v2；这是阅读 Codex 最容易混淆的地方之一。",
    takeaways: [
      "codex-protocol 定义 Submission、Op、Event 和 EventMsg。",
      "app-server-protocol 定义 Thread、Turn、Item 等外部 API。",
      "对外协议兼容性敏感，新开发应集中在 v2。",
    ],
    paths: [
      { label: "内部协议", path: "codex-rs/protocol/src/protocol.rs" },
      { label: "外部协议", path: "codex-rs/app-server-protocol/src/protocol/v2" },
      { label: "App Server 文档", path: "codex-rs/app-server/README.md" },
    ],
  },
  {
    id: "thread-turn-item",
    number: 5,
    eyebrow: "核心脊柱",
    title: "Thread、Turn、Item",
    description:
      "用三个对象理解产品生命周期：Thread 是长期会话，Turn 是一次用户驱动的工作，Item 是流式产出的组成单位。",
    takeaways: [
      "thread/start、resume、fork 管理会话生命线。",
      "turn/start 触发一次 agent 工作，turn/completed 结束。",
      "消息、推理、命令、文件变更和工具结果都能表现为 Item 或通知。",
    ],
    paths: [
      { label: "Thread API", path: "codex-rs/app-server-protocol/src/protocol/v2/thread.rs" },
      { label: "Turn API", path: "codex-rs/app-server-protocol/src/protocol/v2/turn.rs" },
      { label: "Item API", path: "codex-rs/app-server-protocol/src/protocol/v2/item.rs" },
    ],
  },
  {
    id: "runtime-objects",
    number: 6,
    eyebrow: "核心脊柱",
    title: "ThreadManager 与 Session",
    description:
      "从 ThreadManager 进入 CodexThread，再到后台 submission loop，理解一个会话在内存中如何被创建、驱动和关闭。",
    takeaways: [
      "ThreadManager 持有认证、模型、技能、插件、MCP 和存储等共享服务。",
      "CodexThread 是调用者与 Session 之间的双向通道。",
      "Session 通过 submission loop 接收 Op 并产生 Event。",
    ],
    paths: [
      { label: "线程管理器", path: "codex-rs/core/src/thread_manager.rs" },
      { label: "线程对象", path: "codex-rs/core/src/codex_thread.rs" },
      { label: "Session", path: "codex-rs/core/src/session/mod.rs" },
    ],
  },
  {
    id: "agent-loop",
    number: 7,
    eyebrow: "核心脊柱",
    title: "一次 Turn 如何运行",
    description:
      "打开最重要的循环：准备上下文、请求模型、执行工具、把结果送回模型，直到得到最终回答。",
    takeaways: [
      "run_turn 在采样前处理压缩、技能、插件和世界状态。",
      "模型返回 function call 时，工具输出成为下一次采样输入。",
      "循环还要处理重试、steer 输入、token 限制和停止 hooks。",
    ],
    paths: [
      { label: "Turn 主循环", path: "codex-rs/core/src/session/turn.rs" },
      { label: "Session handlers", path: "codex-rs/core/src/session/handlers" },
      { label: "上下文压缩", path: "codex-rs/core/src/compact.rs" },
    ],
  },
  {
    id: "model-layer",
    number: 8,
    eyebrow: "模型层",
    title: "Model Client 与 Responses API",
    description:
      "理解会话级 ModelClient、turn 级 ModelClientSession，以及 API 类型、SSE 流和重试策略的分层。",
    takeaways: [
      "ModelClientSession 为同一 turn 的多次请求复用连接与路由状态。",
      "codex-api 了解 Responses/Compact API，但不负责 agent 业务逻辑。",
      "codex-client 和 http-client 提供更通用的传输、SSE 与重试能力。",
    ],
    paths: [
      { label: "模型客户端", path: "codex-rs/core/src/client.rs" },
      { label: "API 层", path: "codex-rs/codex-api/README.md" },
      { label: "传输策略", path: "codex-rs/codex-client/README.md" },
    ],
  },
  {
    id: "tool-system",
    number: 9,
    eyebrow: "执行层",
    title: "ToolSpec 与 ToolRouter",
    description:
      "从模型可见的 schema 到内部 ToolCall，再到具体 handler，掌握添加或排查工具的完整路径。",
    takeaways: [
      "ToolSpec 决定模型能看到什么工具和参数。",
      "ToolRouter 将 Responses API output 转换成内部 ToolCall 并分派。",
      "共享工具模型正逐步从 core 抽取到 codex-tools。",
    ],
    paths: [
      { label: "工具路由", path: "codex-rs/core/src/tools/router.rs" },
      { label: "工具 handlers", path: "codex-rs/core/src/tools/handlers" },
      { label: "共享工具层", path: "codex-rs/tools/README.md" },
    ],
  },
  {
    id: "execution",
    number: 10,
    eyebrow: "执行层",
    title: "Shell、Patch 与进程",
    description:
      "把 shell command、unified exec、apply_patch、PTY 和远程 exec-server 放到同一张执行能力地图中。",
    takeaways: [
      "shell 工具的模型接口与实际进程执行是分层的。",
      "apply_patch 有独立 parser、工具规范和测试。",
      "exec-server 是控制子进程与文件操作的独立 JSON-RPC 服务。",
    ],
    paths: [
      { label: "Shell handler", path: "codex-rs/core/src/tools/handlers/unified_exec.rs" },
      { label: "Apply Patch", path: "codex-rs/apply-patch" },
      { label: "Exec Server", path: "codex-rs/exec-server/README.md" },
    ],
  },
  {
    id: "security",
    number: 11,
    eyebrow: "安全边界",
    title: "Approval、Sandbox、Network",
    description:
      "工具能执行不代表可以无条件执行。理解审批策略、命令策略、OS 沙箱和网络代理如何共同限制副作用。",
    takeaways: [
      "审批是运行时交互协议的一部分，而不只是 UI 弹窗。",
      "不同操作系统使用不同 sandbox backend。",
      "network-proxy 独立执行域名、方法和本地网络策略。",
    ],
    paths: [
      { label: "Sandboxing", path: "codex-rs/sandboxing/src/lib.rs" },
      { label: "Exec Policy", path: "codex-rs/execpolicy" },
      { label: "Network Proxy", path: "codex-rs/network-proxy/README.md" },
    ],
  },
  {
    id: "extensions",
    number: 12,
    eyebrow: "能力层",
    title: "Skills、Plugins、MCP",
    description:
      "梳理三种扩展路径：Skills 提供指令与资产，Plugins 打包能力，MCP 将外部工具和资源接入模型工具面。",
    takeaways: [
      "扩展能力在 turn 前被解析并转化为模型可见上下文或工具。",
      "core-plugins 负责与核心运行时相关的插件管理。",
      "ext 目录正在形成更明确的可组合能力边界。",
    ],
    paths: [
      { label: "Skills", path: "codex-rs/skills/src/lib.rs" },
      { label: "Plugin", path: "codex-rs/plugin/src/lib.rs" },
      { label: "Extensions", path: "codex-rs/ext" },
    ],
  },
  {
    id: "advanced-capabilities",
    number: 13,
    eyebrow: "能力层",
    title: "Multi-agent 与 Code Mode",
    description:
      "理解子代理关系图、跨线程通信，以及 Code Mode 如何提供一个可以编排嵌套工具调用的执行环境。",
    takeaways: [
      "multi-agent handler 管理 spawn、message、wait 和 follow-up。",
      "agent graph store 保存父子关系和运行状态。",
      "Code Mode 被拆成协议、host 和 runtime 多个 crate。",
    ],
    paths: [
      { label: "Multi-agent", path: "codex-rs/core/src/tools/handlers/multi_agents.rs" },
      { label: "Agent graph", path: "codex-rs/agent-graph-store" },
      { label: "Code Mode", path: "codex-rs/code-mode" },
    ],
  },
  {
    id: "tui",
    number: 14,
    eyebrow: "客户端层",
    title: "TUI 页面架构",
    description:
      "从 app 到 chatwidget、bottom_pane、history cell 和审批视图，建立终端 UI 的开发索引。",
    takeaways: [
      "TUI 是 app-server client，而不是另一套 agent runtime。",
      "ChatWidget 是聊天与事件呈现的核心区域。",
      "输入、审批、skills 和弹层主要集中在 bottom_pane。",
    ],
    paths: [
      { label: "TUI crate", path: "codex-rs/tui/src/lib.rs" },
      { label: "Chat widget", path: "codex-rs/tui/src/chatwidget.rs" },
      { label: "Bottom pane", path: "codex-rs/tui/src/bottom_pane" },
    ],
  },
  {
    id: "app-server-sdk",
    number: 15,
    eyebrow: "客户端层",
    title: "App Server 与 SDK",
    description:
      "比较进程内客户端、stdio/WebSocket JSON-RPC、TypeScript exec wrapper 和 Python typed client。",
    takeaways: [
      "外部 app-server 必须 initialize，然后才能启动或恢复 thread。",
      "TypeScript SDK 包装 codex exec 的流式 JSON 输出。",
      "Python SDK 直接驱动 app-server v2 JSON-RPC。",
    ],
    paths: [
      { label: "App Server", path: "codex-rs/app-server/README.md" },
      { label: "TypeScript SDK", path: "sdk/typescript/src/exec.ts" },
      { label: "Python SDK", path: "sdk/python/src/openai_codex/client.py" },
    ],
  },
  {
    id: "persistence",
    number: 16,
    eyebrow: "数据层",
    title: "History、Rollout、State、Memory",
    description:
      "区分规范会话历史、JSONL rollout、SQLite 查询状态，以及从历史中提取和整合的 memory pipeline。",
    takeaways: [
      "ThreadStore 是会话持久化边界。",
      "LocalThreadStore 组合 rollout JSONL 与 SQLite metadata。",
      "Memory 分成逐 rollout 提取和全局 consolidation 两阶段。",
    ],
    paths: [
      { label: "Thread Store", path: "codex-rs/thread-store/README.md" },
      { label: "Rollout", path: "codex-rs/rollout/src/lib.rs" },
      { label: "Memory", path: "codex-rs/memories/README.md" },
    ],
  },
  {
    id: "config-remote",
    number: 17,
    eyebrow: "运行环境",
    title: "Config、Auth 与 Remote",
    description:
      "把配置合并、认证、模型 provider、cloud tasks、远程环境和本地模型适配器放回运行时全景。",
    takeaways: [
      "config 负责从多层来源得到最终运行参数。",
      "认证与具体 API transport 分离。",
      "cloud 和 remote execution 是独立边界，不应混入本地 turn loop。",
    ],
    paths: [
      { label: "Config", path: "codex-rs/config/src/lib.rs" },
      { label: "Login", path: "codex-rs/login" },
      { label: "Cloud Tasks", path: "codex-rs/cloud-tasks" },
    ],
  },
  {
    id: "developer-workflow",
    number: 18,
    eyebrow: "开始开发",
    title: "测试与变更定位",
    description:
      "最后把架构地图变成行动：确定改动边界、遵守 AGENTS.md、运行 focused tests，并避免把新概念继续塞进 core。",
    takeaways: [
      "优先修改拥有该行为的 crate，并保持协议兼容。",
      "Rust 变更通常至少运行 just fmt 和目标 crate 测试。",
      "仓库当前欢迎问题报告，但贡献文档说明暂不接受外部代码 PR。",
    ],
    paths: [
      { label: "开发约定", path: "AGENTS.md" },
      { label: "贡献说明", path: "docs/contributing.md" },
      { label: "CI workflows", path: ".github/workflows" },
    ],
  },
];

export type LocatorEntry = {
  category: string;
  intent: string;
  path: string;
  note: string;
};

export const locatorEntries: LocatorEntry[] = [
  { category: "入口", intent: "新增 CLI 子命令或参数", path: "codex-rs/cli/", note: "统一二进制入口与子命令分发" },
  { category: "界面", intent: "修改终端聊天页面", path: "codex-rs/tui/src/chatwidget.rs", note: "消息、事件与交互呈现" },
  { category: "界面", intent: "修改输入框或审批弹层", path: "codex-rs/tui/src/bottom_pane/", note: "composer、approval、skills 与 overlays" },
  { category: "入口", intent: "修改非交互 exec 或 review", path: "codex-rs/exec/", note: "流式、人类可读和 JSON 输出" },
  { category: "核心", intent: "修改一次 turn 的运行逻辑", path: "codex-rs/core/src/session/turn.rs", note: "采样、工具、重试、压缩与完成" },
  { category: "核心", intent: "修改 thread 的创建和恢复", path: "codex-rs/core/src/thread_manager.rs", note: "线程生命周期与共享服务" },
  { category: "协议", intent: "新增内部操作或事件", path: "codex-rs/protocol/src/protocol.rs", note: "Submission、Op、EventMsg" },
  { category: "协议", intent: "修改 IDE 或客户端 API", path: "codex-rs/app-server-protocol/src/protocol/v2/", note: "外部 JSON-RPC v2 contract" },
  { category: "服务", intent: "实现新的 app-server request", path: "codex-rs/app-server/src/request_processors/", note: "按 thread、turn、config 等领域拆分" },
  { category: "模型", intent: "修改模型请求或流式响应", path: "codex-rs/core/src/client.rs", note: "ModelClient 与 turn-scoped session" },
  { category: "模型", intent: "修改 Responses API wire types", path: "codex-rs/codex-api/", note: "请求、SSE、错误和 provider 配置" },
  { category: "工具", intent: "增加模型可见工具", path: "codex-rs/core/src/tools/", note: "spec、registry、router 与 handlers" },
  { category: "工具", intent: "增加 MCP 工具或资源", path: "codex-rs/codex-mcp/", note: "MCP 集成与适配" },
  { category: "能力", intent: "修改 Skills", path: "codex-rs/skills/", note: "发现、加载与注入" },
  { category: "能力", intent: "修改 Plugins 或 Extensions", path: "codex-rs/plugin/ · codex-rs/ext/", note: "可组合能力边界" },
  { category: "能力", intent: "修改 Multi-agent", path: "codex-rs/core/src/tools/handlers/multi_agents*", note: "spawn、message、wait 与 agent graph" },
  { category: "执行", intent: "修改 shell 执行", path: "codex-rs/shell-command/", note: "命令解析和执行辅助" },
  { category: "执行", intent: "修改 apply_patch", path: "codex-rs/apply-patch/", note: "patch parser、应用与验证" },
  { category: "安全", intent: "修改命令审批策略", path: "codex-rs/execpolicy/", note: "命令前缀与策略判定" },
  { category: "安全", intent: "修改系统沙箱", path: "codex-rs/sandboxing/", note: "跨平台 sandbox 抽象" },
  { category: "安全", intent: "修改网络访问控制", path: "codex-rs/network-proxy/", note: "HTTP/SOCKS、allow/deny 与审计" },
  { category: "数据", intent: "修改 thread 持久化", path: "codex-rs/thread-store/", note: "存储抽象与本地实现" },
  { category: "数据", intent: "修改 SQLite 状态", path: "codex-rs/state/", note: "migration、runtime 与查询模型" },
  { category: "数据", intent: "修改 Memory pipeline", path: "codex-rs/memories/ · codex-rs/core/src/memories/", note: "读取、提取与 consolidation" },
  { category: "SDK", intent: "修改 TypeScript SDK", path: "sdk/typescript/", note: "codex exec JSON stream wrapper" },
  { category: "SDK", intent: "修改 Python SDK", path: "sdk/python/", note: "typed app-server JSON-RPC client" },
  { category: "分发", intent: "修改 npm 二进制启动逻辑", path: "codex-cli/bin/codex.js", note: "平台包解析与信号转发" },
  { category: "工程", intent: "修改构建、测试或 CI", path: "justfile · .github/ · scripts/ · tools/", note: "开发和发布基础设施" },
];

export const architectureLayers = [
  {
    index: "01",
    name: "Surfaces",
    tone: "用户与客户端",
    items: ["TUI", "codex exec", "IDE", "TypeScript SDK", "Python SDK"],
  },
  {
    index: "02",
    name: "Application boundary",
    tone: "统一生命周期",
    items: ["App Server", "Protocol v2", "Thread / Turn / Item"],
  },
  {
    index: "03",
    name: "Agent runtime",
    tone: "决策与编排",
    items: ["ThreadManager", "Session", "run_turn", "ModelClient", "ToolRouter"],
  },
  {
    index: "04",
    name: "Execution & safety",
    tone: "受控副作用",
    items: ["Shell", "Patch", "MCP", "Approval", "Sandbox", "Network policy"],
  },
  {
    index: "05",
    name: "State",
    tone: "可恢复历史",
    items: ["ThreadStore", "Rollout JSONL", "SQLite", "Memory"],
  },
];

