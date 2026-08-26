export const SOURCE_COMMIT =
  "d4998d611ad37de0aa9723b6fdd2d9a2f8ff4763";

export type Dossier = {
  id: string;
  number: number;
  domain: string;
  title: string;
  question: string;
  thesis: string;
  callPath: string[];
  mechanics: Array<{ title: string; body: string }>;
  tradeoffs: Array<{ decision: string; gain: string; cost: string }>;
  failureModes: string[];
  paths: Array<{ label: string; path: string }>;
};

export const dossiers: Dossier[] = [
  {
    id: "system-boundary",
    number: 1,
    domain: "SYSTEM TOPOLOGY",
    title: "客户端如何汇入同一个 runtime",
    question: "Codex 的产品表面很多，真正的应用边界在哪里？",
    thesis:
      "TUI、exec、IDE 与 SDK 并不是四套 agent。CLI 负责进程入口，app-server 负责面向客户端的生命周期与策略转换，core 才持有 agent runtime。尤其要注意：app-server 不是薄薄一层 JSON serde；它会验证参数、合并配置、处理 project trust、挂载 listener，并把内部 EventMsg 投影为 Thread / Turn / Item 通知。",
    callPath: [
      "cli::main dispatch",
      "app-server request processor",
      "ThreadManager::start_thread",
      "CodexThread / Session",
      "core EventMsg",
      "v2 ServerNotification",
    ],
    mechanics: [
      {
        title: "入口收敛",
        body: "无子命令进入 TUI，exec/review 进入非交互执行器，app-server 暴露 JSON-RPC；它们最终复用同一套 Rust runtime。",
      },
      {
        title: "边界策略",
        body: "thread/start 与 turn/start 在进入 core 前完成配置覆盖、权限互斥校验、环境解析、输入限制和外部类型到内部类型的映射。",
      },
      {
        title: "异步投影",
        body: "request response 只表示命令是否被接受；后续状态通过 listener 消费 core event，再结合 thread-local state 生成对外通知。",
      },
    ],
    tradeoffs: [
      {
        decision: "统一 runtime，不统一 UI",
        gain: "行为、审批与持久化语义可以跨客户端保持一致。",
        cost: "app-server 成为高耦合翻译层，协议变化必须同步多个消费者。",
      },
      {
        decision: "进程内也保留 app-server 语义",
        gain: "TUI/exec 可走 typed channels，避免序列化成本，同时不分叉 contract。",
        cost: "内部 client 必须处理与外部 JSON-RPC 相同的异步时序和 bootstrap 竞态。",
      },
    ],
    failureModes: [
      "把 turn/start response 当作执行完成，会漏掉后续失败、审批与 completion event。",
      "直接在某个客户端实现 runtime 行为，会制造客户端间语义漂移。",
    ],
    paths: [
      { label: "CLI dispatch", path: "codex-rs/cli/src/main.rs" },
      { label: "Thread boundary", path: "codex-rs/app-server/src/request_processors/thread_processor.rs" },
      { label: "Turn boundary", path: "codex-rs/app-server/src/request_processors/turn_processor.rs" },
      { label: "Event projection", path: "codex-rs/app-server/src/bespoke_event_handling.rs" },
    ],
  },
  {
    id: "runtime-ownership",
    number: 2,
    domain: "STATE & CONCURRENCY",
    title: "ThreadManager、CodexThread、Session 谁拥有状态",
    question: "一条 thread 在内存中究竟是什么，谁负责串行化它的变化？",
    thesis:
      "ThreadManager 是进程级 composition root：它持有 thread map 与 auth、models、skills、plugins、MCP、environment、store 等共享服务。CodexThread 是双向 conduit；真正的会话状态在 Session。Session::spawn 启动 submission_loop，以 channel 接收 Submission/Op、以 Event stream 对外发布变化，形成 actor-like 的所有权模型。",
    callPath: [
      "ThreadManagerState shared services",
      "start/resume/fork thread",
      "Arc<CodexThread>",
      "SessionIo::submit(Op)",
      "submission_loop",
      "Session emits Event",
    ],
    mechanics: [
      {
        title: "进程级共享",
        body: "模型目录、认证、MCP、插件与存储不随每个 turn 重建，而由 ThreadManagerState 统一注入新 Session。",
      },
      {
        title: "会话级隔离",
        body: "SessionIo 分离 submission sender、event receiver、status watch 与 termination future；调用者不直接修改 Session 内部状态。",
      },
      {
        title: "顺序控制",
        body: "后台 submission_loop 是 thread 内命令的串行控制面；耗时 turn/tool 工作可以异步，但其生命周期仍由 Session 协调。",
      },
    ],
    tradeoffs: [
      {
        decision: "actor-like channels 代替共享可变 API",
        gain: "生命周期、取消、steer 与事件顺序更容易推理。",
        cost: "状态可见性变为 eventual；调用者必须订阅事件，不能依赖同步返回值。",
      },
      {
        decision: "共享 managers，隔离 sessions",
        gain: "缓存与外部连接可复用，同时 thread 状态仍有明确边界。",
        cost: "共享服务的刷新与 thread-local snapshot 之间需要清晰的一致性策略。",
      },
    ],
    failureModes: [
      "绕过 SessionIo 直接增加共享状态，会破坏取消、关闭或事件顺序的单一入口。",
      "把 CodexThread 当作状态 owner，会误读它与 Session、LiveThread persistence 的责任分工。",
    ],
    paths: [
      { label: "Composition root", path: "codex-rs/core/src/thread_manager.rs" },
      { label: "Thread conduit", path: "codex-rs/core/src/codex_thread.rs" },
      { label: "Session + IO", path: "codex-rs/core/src/session/mod.rs" },
      { label: "Internal messages", path: "codex-rs/protocol/src/protocol.rs" },
    ],
  },
  {
    id: "turn-loop",
    number: 3,
    domain: "CONTROL LOOP",
    title: "一次 Turn 不是一次模型请求",
    question: "agent loop 在什么条件下继续、压缩、被 steer 或真正结束？",
    thesis:
      "run_turn 是 Codex 的控制循环。一次 Turn 可以包含多次 Responses sampling、多个 tool call、用户在途输入、mid-turn compaction 和 stop hook continuation。只有当模型不再要求 follow-up、输入队列为空且 hook 不要求继续时，Turn 才完成；所以 Turn 是工作单元，sampling request 只是其中一次决策。",
    callPath: [
      "prepare context + capabilities",
      "capture StepContext snapshot",
      "run_sampling_request",
      "execute tool calls",
      "record outputs into history",
      "follow-up / compact / complete",
    ],
    mechanics: [
      {
        title: "Step snapshot",
        body: "每次 sampling 前捕获 StepContext，使 prompt、advertised tools 与后续 tool calls 使用同一份 turn settings 和环境视图。",
      },
      {
        title: "闭环执行",
        body: "模型返回 function call 后，runtime 执行工具并把结构化 output 送入下一次 sampling；assistant-only response 才可能结束。",
      },
      {
        title: "动态输入",
        body: "运行中的 mailbox/steer 输入在安全的边界被 drain 进 history；新增 MCP 需求也会触发新的 step context。",
      },
      {
        title: "终止不是单一条件",
        body: "needs_follow_up 同时考虑模型工具链和 pending input；stop hook 还能阻止结束并注入 continuation prompt。",
      },
    ],
    tradeoffs: [
      {
        decision: "长生命周期 Turn",
        gain: "允许工具反馈、用户 steer 与多步推理自然组合。",
        cost: "取消、重复提交、事件顺序与资源占用都比 request/response 更复杂。",
      },
      {
        decision: "每步重建模型可见视图",
        gain: "工具、环境和 world state 可以在长 turn 中更新。",
        cost: "必须防止同一步内 context 与 tool registry 不一致。",
      },
    ],
    failureModes: [
      "只 trace 第一条模型请求，会看不到真正决定结果的工具输出与 continuation。",
      "在 sampling 中途替换 settings，而不重建 StepContext，会出现模型看到的 schema 与实际 handler 不匹配。",
    ],
    paths: [
      { label: "Turn loop", path: "codex-rs/core/src/session/turn.rs" },
      { label: "Regular task lifecycle", path: "codex-rs/core/src/tasks/regular.rs" },
      { label: "Turn context", path: "codex-rs/core/src/session/turn_context.rs" },
      { label: "Stop hooks", path: "codex-rs/core/src/hook_runtime.rs" },
    ],
  },
  {
    id: "context-management",
    number: 4,
    domain: "CONTEXT ECONOMICS",
    title: "Context 是受预算约束的运行时状态",
    question: "如何在有限 context window 中保留工具闭环、世界状态和长期任务连续性？",
    thesis:
      "Codex 没有简单地把 rollout 原样塞给模型。ContextManager 保存模型可见 history envelope，写入时截断超大 tool output，发送前补齐 call/output 配对、移除 orphan、按模型 modality 剥离不支持的内容；Session 还用 reference context 与 world-state baseline 发送差量。接近窗口上限时，pre-turn 或 mid-turn compaction 会重写 history，再继续当前 Turn。",
    callPath: [
      "canonical rollout items",
      "ContextManager::record_items",
      "normalize + modality filter",
      "token estimate/status",
      "auto compact",
      "reinject world/settings delta",
    ],
    mechanics: [
      {
        title: "History 不是 prompt 的逐字副本",
        body: "持久化历史是审计/恢复事实；for_prompt 会规范化、过滤和按 input modalities 投影出本次模型真正看到的上下文。",
      },
      {
        title: "先局部截断，再全局压缩",
        body: "工具输出按 ModelInfo.truncation_policy 限制；整体 token status 同时检查 auto-compact scope 与 full context window。",
      },
      {
        title: "差量 world state",
        body: "reference_context_item 与 world_state_baseline 避免每轮完整重注入 cwd、配置和环境状态；rollback/compact 后必要时重建基线。",
      },
      {
        title: "mid-turn rollover",
        body: "只有仍需 follow-up 且达到 token limit/请求新窗口时才在 turn 内 compact，然后让工具链继续，而不是直接失败。",
      },
    ],
    tradeoffs: [
      {
        decision: "摘要压缩换连续执行",
        gain: "长任务可以跨过单个 context window。",
        cost: "compaction 是有损变换；早期约束、失败细节或证据可能被弱化。",
      },
      {
        decision: "tool output 截断",
        gain: "一次巨量日志不会挤占整个推理预算。",
        cost: "关键错误若落在被截断区域，模型可能得到不完整证据。",
      },
      {
        decision: "估算 token 而非每次精确 tokenize",
        gain: "降低热路径成本并支持多模态近似。",
        cost: "估算误差要求预留 buffer，也可能触发偏早或偏晚的 compaction。",
      },
    ],
    failureModes: [
      "把 rollout 等同于当前 prompt，会误判模型为何遗漏某条信息。",
      "新增 ResponseItem 却没有更新 normalization/token estimate，可能造成 orphan、预算漂移或不支持 modality 泄入请求。",
      "压缩后没有恢复关键 world/settings context，会得到语法正确但环境假设错误的行动。",
    ],
    paths: [
      { label: "Context history", path: "codex-rs/core/src/context_manager/history.rs" },
      { label: "Compaction", path: "codex-rs/core/src/compact.rs" },
      { label: "Window accounting", path: "codex-rs/core/src/session/context_window.rs" },
      { label: "World state", path: "codex-rs/core/src/context/world_state/mod.rs" },
    ],
  },
  {
    id: "model-flexibility",
    number: 5,
    domain: "MODEL ABSTRACTION",
    title: "模型可选择，但并非可无损互换",
    question: "怎样支持模型目录、provider 与 per-turn 选择，又不把模型差异泄漏到整个 runtime？",
    thesis:
      "ModelsManager 负责发现、缓存、认证过滤和选择模型；ModelInfo 把 context window、modalities、truncation、reasoning、tool capabilities 等行为元数据带进 TurnContext；ModelClient 封装 session-stable 的 provider/auth/transport，ModelClientSession 再持有 turn-scoped WebSocket 与 sticky routing state。抽象的核心不是抹平差异，而是把差异集中成显式 metadata 与 settings。",
    callPath: [
      "remote/bundled model catalog",
      "ModelsManager selection",
      "ModelInfo + config overrides",
      "TurnContext settings",
      "ModelClientSession",
      "Responses HTTP/WebSocket",
    ],
    mechanics: [
      {
        title: "动态目录与离线缓存",
        body: "模型目录可 online、offline 或 cache-first 刷新，并按 auth/visibility 过滤；ETag 与 TTL 控制刷新成本。",
      },
      {
        title: "能力跟随 ModelInfo",
        body: "context window、输入模态、reasoning defaults、truncation policy 等不是散落的 if model-name，而是随模型解析进入 settings。",
      },
      {
        title: "两级 client lifetime",
        body: "ModelClient 持有 thread/session 稳定状态；每个 Turn 新建 ModelClientSession，以便复用本 turn 的连接与 sticky token，又避免跨 turn 污染路由。",
      },
      {
        title: "显式 fallback",
        body: "WebSocket 可降级 HTTP，模型选择也有 provider fallback policy；fallback 是被记录的运行时决策，不是静默假定所有后端等价。",
      },
    ],
    tradeoffs: [
      {
        decision: "metadata-driven model abstraction",
        gain: "核心 loop 不需要为每个模型复制一套分支。",
        cost: "catalog metadata 若过期或不完整，context/tool 行为会在运行时才暴露错误。",
      },
      {
        decision: "允许 provider/config override",
        gain: "支持组织策略、local endpoint 与未来模型演进。",
        cost: "兼容 Responses API 不等于语义兼容；tool calling、reasoning 与 token accounting 仍可能不同。",
      },
      {
        decision: "turn-scoped transport state",
        gain: "多次 sampling 可增量复用连接和 sticky route。",
        cost: "复用范围必须严格；跨 turn 复用会造成服务端路由 contract 错误。",
      },
    ],
    failureModes: [
      "只替换 model slug 而不验证 ModelInfo，会让 modality、context 或 tool 假设失真。",
      "将 cache 中的 catalog 当作永久事实，会忽略服务端能力变化；源码中甚至标注了 provider 切换复用 cache 的 TODO。",
    ],
    paths: [
      { label: "Model catalog manager", path: "codex-rs/models-manager/src/manager.rs" },
      { label: "Model metadata overrides", path: "codex-rs/models-manager/src/model_info.rs" },
      { label: "Model transport lifetimes", path: "codex-rs/core/src/client.rs" },
      { label: "Provider description", path: "codex-rs/model-provider-info/src/lib.rs" },
    ],
  },
  {
    id: "tool-runtime",
    number: 6,
    domain: "ACTION PLANE",
    title: "工具系统把概率决策变成可观测执行",
    question: "模型生成的 call 如何变成受控副作用，并重新进入推理闭环？",
    thesis:
      "工具路径被拆成 model-visible ToolSpec、每步冻结的 ToolRouter registry、内部 ToolCall、handler/runtime 和 ResponseInputItem output。ToolCallRuntime 为每个调用启动可取消 task；支持并行的工具获取 read lock，不支持并行的工具获取 write lock，从而让 registry metadata 决定并发，而不是让模型自由并发所有副作用。",
    callPath: [
      "build ToolSpec plan",
      "model emits function/custom call",
      "ToolRouter builds ToolCall",
      "parallel admission gate",
      "handler executes",
      "success/error output returns to model",
    ],
    mechanics: [
      {
        title: "schema 与 runtime 同源",
        body: "模型看到的工具定义和实际 dispatch registry 在 StepContext 中一起冻结，避免调用期间 registry 漂移。",
      },
      {
        title: "显式并发能力",
        body: "tool_supports_parallel 决定共享/独占 gate；并行是 handler 的能力声明，不是所有 function calls 的默认属性。",
      },
      {
        title: "错误也进入闭环",
        body: "非 fatal handler error 会被转换为 success=false 的 function/custom tool output，让模型有机会修正参数或选择另一条路径。",
      },
      {
        title: "取消有 terminal guard",
        body: "runtime 区分调用已经到达 terminal outcome 还是仍可 abort，避免取消与真实完成同时发生时重复合成结果。",
      },
    ],
    tradeoffs: [
      {
        decision: "统一 router，异构 handler",
        gain: "shell、MCP、plugin、multi-agent 都能进入同一 feedback loop。",
        cost: "core 仍承担 Session/TurnContext/approval 依赖，工具模块化只能渐进完成。",
      },
      {
        decision: "安全并行优先于最大吞吐",
        gain: "只让声明为 parallel-safe 的调用并发，降低交叉副作用。",
        cost: "一个独占工具会等待所有共享调用结束，也阻塞新的并行调用。",
      },
    ],
    failureModes: [
      "只增加 ToolSpec 不注册 runtime，模型会看到一个无法执行的能力。",
      "错误标注 supports_parallel，可能让两个写操作基于过期 workspace state 同时执行。",
    ],
    paths: [
      { label: "Tool conversion + dispatch", path: "codex-rs/core/src/tools/router.rs" },
      { label: "Parallel runtime", path: "codex-rs/core/src/tools/parallel.rs" },
      { label: "Registry", path: "codex-rs/core/src/tools/registry.rs" },
      { label: "Tool extraction direction", path: "codex-rs/tools/README.md" },
    ],
  },
  {
    id: "accuracy",
    number: 7,
    domain: "ACCURACY & VERIFICATION",
    title: "Accuracy 不是一个模块，而是一组 feedback contracts",
    question: "Codex 怎样降低模型“说完成了”但环境事实并不支持的概率？",
    thesis:
      "普通 Turn 的终止条件最终仍接受 assistant message；仓库里没有一个能证明任意 coding task 正确的通用 oracle。可靠性来自多层反馈：strict tool/output schema 降低格式歧义，真实工具输出把环境事实送回模型，exit status/success 字段区分执行结果，review/guardian 与 stop hooks 可以增加独立检查，event/rollout 保留证据供客户端和测试验证。架构师必须把这些看作可组合的 assurance layers，而不是把准确性归因于更强模型。",
    callPath: [
      "model proposes action",
      "schema validation",
      "tool executes against environment",
      "result + status enter history",
      "optional review / stop hook",
      "turn completion + persisted evidence",
    ],
    mechanics: [
      {
        title: "执行反馈",
        body: "工具 result 不只是展示文本，而是下一次 sampling 的输入；失败可以被模型观察并自我修正。",
      },
      {
        title: "结构化 contract",
        body: "function parameters、部分工具 output 以及 final output 可携带 JSON schema；strict mode 将格式错误前移到协议层。",
      },
      {
        title: "可插拔检查",
        body: "review task、guardian review session 与 turn stop hooks 能在不同风险路径增加第二判断或阻止过早结束。",
      },
      {
        title: "证据可回放",
        body: "Event 与 rollout 记录输入、调用和输出，使集成测试能断言行为链，而不只比较最终自然语言。",
      },
    ],
    tradeoffs: [
      {
        decision: "environment feedback 代替纯文本自省",
        gain: "编译、测试、文件 diff 和命令结果提供外部证据。",
        cost: "增加 latency/token/副作用，而且工具本身也可能返回不完整或过期信息。",
      },
      {
        decision: "review 是可选层，不是全局门禁",
        gain: "低风险任务不必为每次完成支付双模型成本。",
        cost: "默认路径不能保证模型主动执行了足够验证。",
      },
      {
        decision: "schema 保证形状，不保证事实",
        gain: "消费者能稳定解析结果。",
        cost: "合法 JSON 仍可能包含错误结论；语义验证必须来自领域检查。",
      },
    ],
    failureModes: [
      "把 turn/completed 当作任务正确，只能证明控制循环停止，不能证明测试通过。",
      "只断言最终消息会掩盖错误的工具选择、未执行的验证或被吞掉的失败结果。",
      "review agent 复用同一错误上下文或没有独立证据时，第二次判断不等于独立验证。",
    ],
    paths: [
      { label: "Tool result contract", path: "codex-rs/core/src/tools/context.rs" },
      { label: "Structured output", path: "codex-rs/core/src/client_common.rs" },
      { label: "Review task", path: "codex-rs/core/src/tasks/review.rs" },
      { label: "Guardian review", path: "codex-rs/core/src/guardian/review_session.rs" },
    ],
  },
  {
    id: "safety",
    number: 8,
    domain: "SIDE-EFFECT SAFETY",
    title: "Approval 与 Sandbox 解决的是不同问题",
    question: "当 agent 可以执行任意命令时，意图授权与技术隔离如何组合？",
    thesis:
      "Exec policy 先根据命令解析、approval policy、permission profile、sandbox override 和项目 trust 决定是否允许、询问或拒绝；真正执行时再由 OS sandbox 与 network policy 限制可触达资源。Approval 是人类对意图的授权，sandbox 是即使模型或用户判断失误也要成立的技术边界，两者不能互相替代。",
    callPath: [
      "tool command parsed",
      "exec policy decision",
      "approval request/rejection",
      "permission profile",
      "OS sandbox / network proxy",
      "auditable result",
    ],
    mechanics: [
      {
        title: "策略先于执行",
        body: "危险命令、规则匹配、untrusted project 与 sandbox override 共同决定 approval requirement。",
      },
      {
        title: "权限是 turn setting",
        body: "app-server 在 turn/start 解析 permissions/environment，使客户端请求最终成为 core 可执行的明确 permission profile。",
      },
      {
        title: "平台后端不同",
        body: "macOS、Linux、Windows 的 sandbox 实现不同；策略 shape 一致不代表底层 enforcement 完全等价。",
      },
    ],
    tradeoffs: [
      {
        decision: "policy + sandbox 双层防护",
        gain: "授权 UX 与最小权限 enforcement 可以独立演进。",
        cost: "用户看到的允许/拒绝原因更复杂，跨平台行为也更难完全一致。",
      },
      {
        decision: "可复用 prefix approval",
        gain: "重复安全操作减少人工中断。",
        cost: "规则粒度过宽会把一次授权扩张为未来命令的长期权限。",
      },
    ],
    failureModes: [
      "把 UI 中隐藏工具当作授权，会留下直接协议调用的绕过路径。",
      "只测试 policy decision 而不测试实际 sandbox backend，无法证明资源访问真的被阻断。",
    ],
    paths: [
      { label: "Exec policy", path: "codex-rs/core/src/exec_policy.rs" },
      { label: "Sandbox abstraction", path: "codex-rs/sandboxing/src/lib.rs" },
      { label: "Command policy crate", path: "codex-rs/execpolicy" },
      { label: "Network enforcement", path: "codex-rs/network-proxy/README.md" },
    ],
  },
  {
    id: "persistence-memory",
    number: 9,
    domain: "DURABILITY & MEMORY",
    title: "History、Metadata、Memory 是三种不同的 truth",
    question: "恢复会话、查询列表和跨会话学习为什么不能共用一个存储概念？",
    thesis:
      "ThreadStore 将 canonical history append 与 metadata update 明确拆开；LocalThreadStore 用 rollout JSONL 保存可回放历史，用 SQLite 保存可查询 metadata。Memory 又位于更高层：Phase 1 从多个 eligible rollout 中模型化提取，Phase 2 在全局锁下选择、合并并让 consolidation agent 更新文件系统 memory artifacts。历史是发生过什么，metadata 是如何索引，memory 是从历史推导出的可复用结论。",
    callPath: [
      "Session emits canonical items",
      "LiveThread append history",
      "derive metadata patch",
      "JSONL + SQLite",
      "Phase 1 rollout extraction",
      "Phase 2 global consolidation + injection",
    ],
    mechanics: [
      {
        title: "history-first ordering",
        body: "LiveThread 先 append canonical items，再观察新增项并提交 metadata patch；store 不从 raw history 暗中推断 metadata。",
      },
      {
        title: "两种本地表示",
        body: "JSONL 优先可回放与兼容，SQLite 优先列表、筛选和 job coordination；两者服务不同访问模式。",
      },
      {
        title: "两阶段 memory",
        body: "Phase 1 并行、带 lease 地提取单 thread memory；Phase 2 串行持有全局锁，根据 usage/recency 选择输入并更新共享 memory workspace。",
      },
      {
        title: "后台而非热路径",
        body: "memory pipeline 仅在 eligible root session 启动时异步运行，避免阻塞用户当前 turn，也避免 sub-agent 递归生成 memory。",
      },
    ],
    tradeoffs: [
      {
        decision: "history 与 metadata 分离",
        gain: "存储层保持 literal，新的观察语义不污染 canonical append contract。",
        cost: "两步写入存在 metadata 暂时落后的窗口，需要 sync/repair 语义。",
      },
      {
        decision: "模型生成 long-term memory",
        gain: "可以压缩大量 rollout，提炼用户偏好与可复用经验。",
        cost: "memory 是推导结论，不是事实数据库；会有遗漏、误归因与陈旧风险。",
      },
      {
        decision: "usage + recency 选择",
        gain: "有限 context 下优先注入更可能有价值的记忆。",
        cost: "低频但关键的信息可能因长期未使用而退出 consolidation 集合。",
      },
    ],
    failureModes: [
      "把 SQLite row 当作完整会话，会丢失 canonical item 顺序与模型可见内容。",
      "把 memory 当成权威事实，会把一次模型提取错误稳定地传播到未来 session。",
      "在 raw append 内增加隐式 metadata 推断，会让不同 store 实现产生不一致语义。",
    ],
    paths: [
      { label: "Persistence contract", path: "codex-rs/thread-store/README.md" },
      { label: "Active thread ordering", path: "codex-rs/thread-store/src/live_thread.rs" },
      { label: "Memory architecture", path: "codex-rs/memories/README.md" },
      { label: "Phase 1 extraction", path: "codex-rs/memories/write/src/phase1.rs" },
    ],
  },
  {
    id: "extensions-evolution",
    number: 10,
    domain: "EXTENSIBILITY",
    title: "能力扩展与 core 的边界张力",
    question: "Skills、MCP、plugins、Code Mode、multi-agent 如何加入系统而不继续膨胀 core？",
    thesis:
      "扩展能力在 turn/step 边界被解析：Skills 主要影响 instructions/context，MCP 与 plugins 影响 tool surface，multi-agent 把另一个 Session/Thread 纳入工具图，Code Mode 提供嵌套工具编排 runtime。仓库正在把共享工具模型、memory read/write 等能力抽成 crate，但需要 Session、TurnContext、approval 的 orchestration 仍留在 core——这是有意识的渐进模块化，而非已经完成的 plugin kernel。",
    callPath: [
      "discover capability",
      "resolve per input/turn",
      "inject instructions or ToolSpec",
      "capture in StepContext",
      "dispatch through shared runtime",
      "events/history return to parent thread",
    ],
    mechanics: [
      {
        title: "解析时机不同",
        body: "Skills/plugins 可根据用户输入选择；MCP server 可能按本轮需求启动；最终 model-visible capability 在 sampling 前冻结。",
      },
      {
        title: "multi-agent 复用 thread primitive",
        body: "spawn/message/wait 不是独立 agent framework，而是 handler 通过 thread manager/agent graph 协调新的会话节点。",
      },
      {
        title: "逐步抽 crate",
        body: "codex-tools 文档明确区分可抽出的 host-side model/adapter 与仍依赖 session orchestration 的部分。",
      },
    ],
    tradeoffs: [
      {
        decision: "在 step 边界冻结 capability",
        gain: "同一次 sampling 的 schema 与 execution runtime 一致。",
        cost: "运行中新增能力通常要等下一个 step 才可见。",
      },
      {
        decision: "渐进抽离 core",
        gain: "保留生产兼容与现有生命周期语义，避免一次性重写。",
        cost: "短期会同时存在新 crate 和 core adapter，开发者必须辨认真正 ownership。",
      },
      {
        decision: "multi-agent 作为 tool",
        gain: "delegation 自然进入同一 approval、event、history 与 cancellation 体系。",
        cost: "并发 thread 带来 context duplication、协调延迟和更难归因的准确性问题。",
      },
    ],
    failureModes: [
      "只在 discovery UI 注册能力而未进入 StepContext/ToolRouter，模型仍无法可靠调用。",
      "为新能力直接增加 Session 字段而不寻找已有 crate/extension boundary，会继续放大 codex-core 的维护成本。",
    ],
    paths: [
      { label: "Skills", path: "codex-rs/skills/src/lib.rs" },
      { label: "Plugin model", path: "codex-rs/plugin/src/lib.rs" },
      { label: "Multi-agent handlers", path: "codex-rs/core/src/tools/handlers/multi_agents.rs" },
      { label: "Code Mode", path: "codex-rs/code-mode" },
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
  { category: "边界", intent: "新增 CLI 子命令或改变进程入口", path: "codex-rs/cli/", note: "只负责命令路由；不要在这里实现 agent 逻辑" },
  { category: "边界", intent: "修改客户端 Thread / Turn / Item API", path: "codex-rs/app-server-protocol/src/protocol/v2/", note: "外部兼容 contract；再追到 request_processors 与 event projection" },
  { category: "边界", intent: "实现 app-server request 或 notification", path: "codex-rs/app-server/src/request_processors/", note: "配置/权限映射与 core orchestration 的应用边界" },
  { category: "Runtime", intent: "改变 thread 创建、恢复、fork 或共享服务", path: "codex-rs/core/src/thread_manager.rs", note: "进程级 composition root 与 thread ownership" },
  { category: "Runtime", intent: "改变 Op/Event 或 session 生命周期", path: "codex-rs/core/src/session/", note: "submission loop、TurnContext 与 task lifecycle" },
  { category: "Runtime", intent: "改变 agent loop 的继续/完成条件", path: "codex-rs/core/src/session/turn.rs", note: "sampling、pending input、compact 与 stop hook 汇合点" },
  { category: "Context", intent: "改变 prompt history、tool output 截断或 modality", path: "codex-rs/core/src/context_manager/", note: "canonical history 到 model-visible prompt 的投影" },
  { category: "Context", intent: "改变 auto-compaction 或 token budget", path: "codex-rs/core/src/compact.rs", note: "同时检查 session/context_window 与模型 metadata" },
  { category: "模型", intent: "改变模型发现、缓存、默认选择", path: "codex-rs/models-manager/", note: "catalog、auth filter、ETag/TTL 与 ModelInfo 构造" },
  { category: "模型", intent: "改变 Responses 请求、SSE/WebSocket 或 retry", path: "codex-rs/core/src/client.rs", note: "session-stable client 与 turn-scoped transport state" },
  { category: "模型", intent: "增加 provider 或 endpoint 配置", path: "codex-rs/model-provider-info/", note: "provider capability/auth/endpoint description" },
  { category: "工具", intent: "增加模型可见工具", path: "codex-rs/core/src/tools/", note: "同时检查 spec plan、registry、router、handler 与 output contract" },
  { category: "工具", intent: "改变工具并发或取消语义", path: "codex-rs/core/src/tools/parallel.rs", note: "read/write admission gate 与 terminal outcome" },
  { category: "工具", intent: "增加 MCP 工具、资源或 server lifecycle", path: "codex-rs/codex-mcp/", note: "外部 capability 接入与适配" },
  { category: "安全", intent: "改变命令审批/规则匹配", path: "codex-rs/core/src/exec_policy.rs", note: "approval intent；仍需验证实际 sandbox enforcement" },
  { category: "安全", intent: "改变文件系统隔离", path: "codex-rs/sandboxing/", note: "跨平台后端与 permission profile" },
  { category: "安全", intent: "改变网络访问控制", path: "codex-rs/network-proxy/", note: "域名、方法、本地网络与审计边界" },
  { category: "数据", intent: "改变 canonical history/metadata persistence", path: "codex-rs/thread-store/", note: "append history 与 metadata mutation 是两个 contract" },
  { category: "数据", intent: "改变 SQLite 查询或 background job state", path: "codex-rs/state/", note: "query model、migrations、memory leases" },
  { category: "Memory", intent: "改变跨会话 memory 提取或 consolidation", path: "codex-rs/memories/", note: "read/write crates与两阶段后台 pipeline" },
  { category: "能力", intent: "改变 Skills discovery/injection", path: "codex-rs/skills/", note: "instruction/context capability，不等于 runtime authorization" },
  { category: "能力", intent: "改变 Plugins / Extensions", path: "codex-rs/plugin/ · codex-rs/ext/", note: "能力包装与 extension API 边界" },
  { category: "能力", intent: "改变 multi-agent spawn/message/wait", path: "codex-rs/core/src/tools/handlers/multi_agents.rs", note: "从 tool handler 追到 thread manager 与 agent graph" },
  { category: "验证", intent: "改变 review / guardian 检查", path: "codex-rs/core/src/tasks/review.rs · codex-rs/core/src/guardian/", note: "可选 assurance layer，不是所有 turn 的 correctness oracle" },
  { category: "客户端", intent: "修改 TUI 消息/审批/输入投影", path: "codex-rs/tui/src/", note: "消费 app-server semantics；不要复制 runtime state" },
  { category: "SDK", intent: "修改 TypeScript SDK", path: "sdk/typescript/", note: "codex exec experimental JSON stream wrapper" },
  { category: "SDK", intent: "修改 Python SDK", path: "sdk/python/", note: "typed app-server v2 JSON-RPC client" },
];

export const architectureLayers = [
  {
    index: "01",
    name: "Client projections",
    tone: "交互与呈现",
    items: ["TUI", "codex exec", "IDE", "TypeScript SDK", "Python SDK"],
  },
  {
    index: "02",
    name: "Application boundary",
    tone: "命令受理与协议投影",
    items: ["App Server", "Protocol v2", "validation", "config/permission mapping"],
  },
  {
    index: "03",
    name: "Agent control plane",
    tone: "状态所有权与决策循环",
    items: ["ThreadManager", "Session actor", "TurnContext", "run_turn", "ModelClient"],
  },
  {
    index: "04",
    name: "Action plane",
    tone: "环境反馈与受控副作用",
    items: ["ToolRouter", "Shell/Patch", "MCP", "Approval", "Sandbox", "Network"],
  },
  {
    index: "05",
    name: "Durability & learning",
    tone: "事实、索引与推导记忆",
    items: ["Canonical history", "Rollout JSONL", "SQLite metadata", "Memory pipeline"],
  },
];

export const architecturePressures = [
  {
    name: "CONTEXT",
    thesis: "continuity ↔ information loss",
    note: "截断、差量注入与 compaction 共同管理有限窗口；每一种节省都可能损失证据。",
  },
  {
    name: "MODEL",
    thesis: "flexibility ↔ semantic drift",
    note: "catalog 与 ModelInfo 集中模型差异，但 provider 兼容不代表 tool/reasoning 语义完全等价。",
  },
  {
    name: "MEMORY",
    thesis: "reuse ↔ stale inference",
    note: "长期 memory 来自模型化提取与 consolidation，是有价值的推导，不是 canonical truth。",
  },
  {
    name: "ACCURACY",
    thesis: "assurance ↔ latency & cost",
    note: "schema、真实执行、review 与 hooks 叠加可信度；没有通用模块能证明任意任务正确。",
  },
];
