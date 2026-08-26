export type SourceEvidence = {
  label: string;
  path: string;
  lines: [number, number];
  proves: string;
};

export type ManualSection = {
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type ManualChapter = {
  id: string;
  objectives: string[];
  diagram: {
    title: string;
    caption: string;
    lanes: Array<{ label: string; nodes: string[] }>;
  };
  sections: ManualSection[];
  codeReading: { title: string; steps: string[] };
  invariants: string[];
  reviewQuestions: string[];
  evidence: SourceEvidence[];
};

export const manualChapters: Record<string, ManualChapter> = {
  "system-boundary": {
    id: "system-boundary",
    objectives: [
      "区分产品入口、application boundary、agent runtime 与 action plane",
      "理解为什么 app-server 的同步响应不是 Turn 的最终结果",
      "识别一次请求跨越的内部协议、外部协议与持久化投影",
      "建立从功能需求反查源码 owner 的全局地图",
    ],
    diagram: {
      title: "Codex 端到端系统架构",
      caption: "实线表示控制/事件流；每一行是一个责任边界，不是部署拓扑。核心分界是：客户端发命令，Session 拥有状态，模型提出动作，受策略约束的工具执行动作。",
      lanes: [
        { label: "PRODUCT SURFACES", nodes: ["TUI", "codex exec", "IDE / App", "TS / Python SDK"] },
        { label: "APPLICATION BOUNDARY", nodes: ["CLI dispatch", "app-server JSON-RPC", "request processors", "event projection"] },
        { label: "CONTROL PLANE", nodes: ["ThreadManagerState", "CodexThread", "Session actor", "run_turn"] },
        { label: "DECISION + ACTION", nodes: ["ContextManager", "ModelClientSession", "ToolRouter", "approval + sandbox"] },
        { label: "DURABILITY", nodes: ["rollout JSONL", "SQLite metadata", "stage-1 memory", "consolidated memory"] },
      ],
    },
    sections: [
      {
        number: "1.1",
        title: "先用四个平面理解仓库，而不是按目录背诵",
        paragraphs: [
          "Codex 的物理仓库很大，但逻辑上可以先压缩为四个平面。Surface plane 接收人类或 SDK 的命令；control plane 决定 thread/turn 生命周期；decision/action plane 在模型和工具之间建立反馈循环；durability plane 保存可回放事实、查询索引与推导记忆。这个切法比把 codex-rs 下的 crate 平铺出来更接近真实运行时。",
          "这些平面不是彼此独立的服务。当前实现以 Rust 进程内组合为主：ThreadManagerState 持有共享 managers，CodexThread 暴露双向通道，Session 通过 submission loop 串行处理 thread 级控制，run_turn 再进入多轮 sampling/tool feedback。边界主要通过类型、channel 和事件建立，而不是网络 hop。",
        ],
        bullets: [
          "产品入口可以不同，但不应各自实现 agent loop。",
          "app-server 是 anti-corruption layer：它做校验、配置合并、权限转换和状态投影。",
          "工具输出会重新进入 history，成为下一次模型决策的证据。",
          "history、metadata、memory 分开，因为它们的一致性和可信度不同。",
        ],
      },
      {
        number: "1.2",
        title: "一条 Turn 的主链路：接受命令只是开始",
        paragraphs: [
          "turn/start 首先验证输入，解析 cwd/environment，并把外部的 model、effort、approval、permission profile 等覆盖项转换成 TurnInputRequest。随后 CodexThread::start_or_steer_turn 把请求送入 Session。此时 app-server 可以返回 status=InProgress 的 Turn；它还没有 tool items、完成时间或最终消息。",
          "真正的执行在事件流中继续：Session 创建 TurnContext，run_turn 构建 prompt view，ModelClientSession 发起 sampling，ToolRouter 将模型调用映射到 handler，执行结果写回 history。只有模型不再要求 follow-up、没有 pending input，且 stop hook 不要求继续时，Turn 才会发出完成或中断事件。外层 listener 再把内部事件投影为 Thread/Turn/Item 通知。",
        ],
      },
      {
        number: "1.3",
        title: "两套协议是刻意隔离，不是重复建模",
        paragraphs: [
          "codex-protocol 的 Submission、Op、Event、EventMsg 面向 core 内部控制；app-server-protocol 的 Thread、Turn、Item 面向稳定的客户端体验。内部协议关心如何驱动 actor，外部协议关心资源生命周期、增量通知与兼容性。把两者强行合并，会让内部重构直接变成公开 breaking change。",
          "成本是每个新语义都要经过双向映射和状态投影。尤其 TurnComplete 并不是简单复制一个 core status：app-server 会结合 TurnSummary、last_error 和 last_agent_message 决定 Completed 或 Failed；TurnAborted 则投影为 Interrupted。因此修改事件时，必须同时检查 request processor、listener、bespoke event handling 与客户端类型。",
        ],
      },
      {
        number: "1.4",
        title: "从架构需求定位目录",
        paragraphs: [
          "若修改客户端可见 contract，从 app-server-protocol/v2 和 app-server request processor 开始；若修改 thread ownership、turn loop 或 context，从 core 开始；若修改模型目录与缓存，从 models-manager 开始；若修改 canonical history 与检索索引，从 thread-store 开始；若修改跨会话记忆，从 memories README 指向的 core orchestration 开始。",
          "仓库自己的 AGENTS.md 明确提醒 codex-core 已经偏大，新概念应优先放入已有的专用 crate 或新 crate，但不能只为了“抽取”创建一个反向依赖 Session/TurnContext 的空壳。边界是否成功，取决于它是否拥有独立数据模型和生命周期，而不是文件是否移动。",
        ],
      },
      {
        number: "1.5",
        title: "全局 trade-off：统一语义换来翻译与一致性压力",
        paragraphs: [
          "统一 runtime 让 TUI、exec、IDE 和 SDK 共享审批、工具与持久化语义，这是最重要的结构优势。代价是 application boundary 变厚：它必须把客户端意图可靠地翻译成 core 操作，并把异步事件重新投影成客户端状态。任何同步捷径都会制造客户端间漂移。",
          "local-first persistence 提供了可回放和离线恢复，但也引入多个 truth surface。canonical rollout 最接近发生过的事实；SQLite metadata 是查询投影，允许短暂滞后；memory 是模型推导的辅助信息，必须允许过期和遗漏。架构准确性的基础不是“只有一个数据库”，而是明确每种状态能证明什么。",
        ],
      },
      {
        number: "1.6",
        title: "Transport and backpressure are part of the contract",
        paragraphs: [
          "External app-server supports stdio JSONL, experimental WebSocket, and a Unix-socket control path. TUI and exec use app-server-client in-process with typed channels, but still keep the app-server response envelope and lifecycle semantics. Removing JSON serialization does not create a separate runtime contract.",
          "The queues between ingress, request processing, and outbound writes are bounded. Saturated external ingress returns JSON-RPC error -32001 and clients are expected to retry with exponential backoff and jitter. The in-process client uses bounded command queues, but its local consumer event queue is unbounded so unread notifications cannot block the response the caller is waiting for. This is an explicit deadlock-avoidance trade-off: bounded runtime pressure, potentially growing client-side event memory.",
        ],
      },
    ],
    codeReading: {
      title: "建议的第一次源码穿行",
      steps: [
        "从 codex-rs/cli/src/main.rs 看产品入口如何 dispatch。",
        "进入 app-server 的 thread_processor.rs 与 turn_processor.rs，记录所有边界校验和覆盖项。",
        "跟到 ThreadManager::start_thread、CodexThread::start_or_steer_turn 与 Session::spawn。",
        "在 session/turn.rs 跟一遍 sampling → tool result → follow-up。",
        "最后读 thread-store 与 memories README，区分事实、索引和推导。",
      ],
    },
    invariants: [
      "客户端 request 成功，不代表 Turn 成功。",
      "Session 是 thread 控制状态的 owner；UI 和 listener 只消费投影。",
      "工具执行结果必须回到同一个 StepContext 对应的反馈链。",
      "canonical history、prompt view、metadata、memory 不可互相替代。",
    ],
    reviewQuestions: [
      "为什么 app-server 不能退化成纯 serde 层？",
      "新增一个 EventMsg 时，至少需要检查哪些外部投影？",
      "为什么把 TUI 与 SDK 做成两套 agent loop 会破坏架构？",
      "哪一种状态可以回答“实际发生过什么”？哪一种只适合搜索？",
    ],
    evidence: [
      { label: "CLI dispatch", path: "codex-rs/cli/src/main.rs", lines: [180, 300], proves: "多个产品入口在同一二进制中收敛到共享 runtime。" },
      { label: "Turn acceptance", path: "codex-rs/app-server/src/request_processors/turn_processor.rs", lines: [497, 638], proves: "turn/start 做边界转换并先返回 InProgress。" },
      { label: "Process owner", path: "codex-rs/core/src/thread_manager.rs", lines: [339, 365], proves: "ThreadManagerState 持有 thread map 与共享 managers。" },
      { label: "Turn loop", path: "codex-rs/core/src/session/turn.rs", lines: [145, 530], proves: "一个 Turn 包含多次 sampling、输入 drain、compaction 与 stop hook。" },
      { label: "Persistence contract", path: "codex-rs/thread-store/README.md", lines: [1, 31], proves: "history append 与 metadata update 是两个明确 API。" },
      { label: "Context invariants", path: "AGENTS.md", lines: [72, 120], proves: "仓库声明 core extraction、context 与 breaking-change 约束。" },
      { label: "External transport pressure", path: "codex-rs/app-server/README.md", lines: [20, 55], proves: "app-server transports use bounded queues and expose overload as retryable JSON-RPC error -32001." },
      { label: "In-process transport", path: "codex-rs/app-server-client/README.md", lines: [27, 66], proves: "TUI/exec keep app-server semantics over typed channels with explicit queue and shutdown behavior." },
    ],
  },

  "runtime-ownership": {
    id: "runtime-ownership",
    objectives: ["区分 process、thread、turn、step 四种生命周期", "理解 actor-like Session 如何串行化控制状态", "识别 shared manager 与 thread snapshot 的一致性边界"],
    diagram: {
      title: "运行时 ownership 与生命周期",
      caption: "上层对象生命周期更长；箭头表示创建或持有。StepContext 是每次 sampling 的能力快照，不是全局可变配置。",
      lanes: [
        { label: "PROCESS", nodes: ["ThreadManagerState", "models / auth", "MCP / plugins", "ThreadStore"] },
        { label: "THREAD", nodes: ["Arc<CodexThread>", "Session", "SessionIo", "submission_loop"] },
        { label: "TURN", nodes: ["TurnContext", "input queue", "active turn", "ModelClientSession"] },
        { label: "STEP", nodes: ["StepContext", "prompt view", "ToolRegistry", "tool futures"] },
      ],
    },
    sections: [
      { number: "2.1", title: "ThreadManagerState 是 composition root，不是 agent loop", paragraphs: ["ThreadManagerState 维护内存中的 thread map，并持有 AuthManager、ModelsManager、EnvironmentManager、skills、plugins、MCP、Code Mode、ThreadStore 等进程级服务。它决定新 thread 用哪些共享依赖，但不会亲自完成每个 sampling step。", "这种设计让昂贵缓存与连接跨 thread 复用，同时把用户会话状态留在 Session。风险是共享 manager 随时间刷新，而进行中的 Turn 依赖已捕获 snapshot；新增配置必须明确是立即生效、下个 turn 生效，还是新 thread 才生效。"] },
      { number: "2.2", title: "CodexThread 是 façade，Session 才是状态 owner", paragraphs: ["CodexThread 持有 Arc<Session>、SessionIo、source/config/rollout 信息，并被源码描述为组成 thread 消息双向流的 conduit。它给外层提供 start、steer、interrupt、subscribe 等稳定入口，但不应被理解为另一份会话状态。", "Session::spawn 构建内部状态后启动 submission_loop。调用者通过 Submission sender 发送 Op，通过 Event receiver 和 AgentStatus watch 观察变化。把写操作集中到一个控制循环，比向多个 UI 暴露共享可变结构更容易保证事件顺序与取消语义。"] },
      { number: "2.3", title: "四种生命周期防止配置与能力泄漏", paragraphs: ["process 级对象负责连接、缓存和注册表；thread 级对象负责 history、active turn 与输入队列；turn 级 TurnContext 决定模型、权限、cwd 与环境；step 级 StepContext 冻结本次 sampling 可见的工具和 world state。", "最常见的错误是把 step 信息提升为 process 全局，或让异步 tool future 回头读取已经变化的 turn 配置。ToolCallRuntime 因此保留发起调用时的 StepContext：即使工具晚于模型响应执行，它仍使用当时对模型声明的能力与策略。"] },
      { number: "2.4", title: "fork 暴露了 actor 与持久化之间的边界", paragraphs: ["fork 不只是复制数据库行。若 snapshot 发生在 mid-turn，历史可能包含尚未形成完整 user/assistant 边界的 items。ThreadManager 的 ForkSnapshot 可以截断到第 n 个 user message 之前，或合成 Interrupted marker，使恢复后的 thread 不把半完成动作误当成成功结果。", "这说明内存 actor 与 durable rollout 是两种时间视图。恢复和 fork 的正确性不能只看反序列化是否成功，还要验证边界处的 tool call/output 配对、active turn 状态和对外 lifecycle 投影。"] },
      { number: "2.5", title: "resume reconstructs Session state; it does not revive the old actor", paragraphs: ["thread/resume reads persisted history and restorable thread settings, then creates a new in-memory Session. The new actor must rebuild initial messages, model-visible history, permission settings, and lifecycle notifications from rollout/state data. A loaded thread and a stored thread with the same id are therefore not the same runtime object.", "fork creates a new thread id and copies a selected history prefix. resume keeps identity and continues the existing history. Tests cover both because the failure modes differ: resume can omit persisted settings or initial events; fork can copy an invalid mid-turn suffix or lose the exact boundary requested by the caller." ] },
    ],
    codeReading: { title: "沿 ownership 阅读", steps: ["列出 ThreadManagerState 的所有字段并按进程级/线程级分类。", "从 CodexThread::start_or_steer_turn 跟进 Submission。", "在 Session::spawn 找到 channel 和 submission_loop 的创建点。", "搜索 StepContext 的 capture 与异步工具持有位置。"] },
    invariants: ["thread 状态通过 Session control loop 修改。", "共享 manager 不等于进行中 Turn 的即时可变配置。", "异步工具必须绑定发起时的 StepContext。"],
    reviewQuestions: ["为什么 ThreadManagerState 不应该直接执行 tool call？", "CodexThread 与 Session 的职责差异是什么？", "fork mid-turn 时为何需要 Interrupted marker？"],
    evidence: [
      { label: "ThreadManagerState", path: "codex-rs/core/src/thread_manager.rs", lines: [339, 365], proves: "进程级共享依赖与 thread map 的所有权。" },
      { label: "CodexThread", path: "codex-rs/core/src/codex_thread.rs", lines: [210, 235], proves: "thread façade 持有 Session 与 SessionIo。" },
      { label: "Session IO", path: "codex-rs/core/src/session/mod.rs", lines: [381, 407], proves: "submission、event、status 与 termination 通道。" },
      { label: "Actor spawn", path: "codex-rs/core/src/session/mod.rs", lines: [780, 812], proves: "Session::spawn 启动 submission_loop。" },
      { label: "Fork snapshot", path: "codex-rs/core/src/thread_manager.rs", lines: [155, 205], proves: "mid-turn snapshot 的截断与中断表达。" },
      { label: "Resume reconstruction test", path: "codex-rs/core/tests/suite/resume.rs", lines: [23, 107], proves: "resume restores settings and rebuilds initial events from the rollout." },
      { label: "Fork history boundary test", path: "codex-rs/core/tests/suite/fork_thread.rs", lines: [30, 155], proves: "fork copies an exact rollout prefix into a new thread." },
    ],
  },

  "turn-loop": {
    id: "turn-loop",
    objectives: ["区分 Turn、sampling request 与 tool execution", "理解 follow-up、steer、retry、compact 和 stop hook 的不同控制语义", "能定位一次 Turn 为什么继续或结束"],
    diagram: {
      title: "一次 Turn 内部的反馈循环",
      caption: "虚拟回路由 tool output 和 pending user input共同驱动。Transport retry 只重试模型传输；follow-up 才会进入下一轮决策。",
      lanes: [
        { label: "PREPARE", nodes: ["drain hooks", "pre-compact", "resolve MCP", "capture StepContext"] },
        { label: "DECIDE", nodes: ["history.for_prompt", "sampling request", "stream response", "collect calls"] },
        { label: "ACT", nodes: ["ToolRouter", "parallel gate", "policy / approval", "record output"] },
        { label: "CONTINUE?", nodes: ["model follow-up", "pending input", "mid-turn compact", "stop hook"] },
      ],
    },
    sections: [
      { number: "3.1", title: "Turn 是工作事务，不是一次 HTTP request", paragraphs: ["run_turn 在进入主循环前处理异步 hook、创建 turn-scoped ModelClientSession、执行 pre-sampling compaction、解析本轮需要的 MCP 与插件，并记录用户输入。随后每次循环都重新 drain pending input、捕获 StepContext、更新 world state、从 history 生成 prompt view，再发起 sampling。", "模型返回 tool call 后，工具输出被记录为 ResponseItem，下一次 sampling 才能利用它。一个 Turn 因而可以包含多次模型调用和多个副作用。把 token、latency 或失败率按 turn 统计时，不能把它等同于一个模型 API request。"] },
      { number: "3.2", title: "继续条件由模型和运行时共同决定", paragraphs: ["核心条件是 needs_follow_up = model_needs_follow_up || has_pending_input。模型要求工具反馈只是一个来源；用户在执行中 steer 进来的新输入也会迫使循环继续。若接近 token limit 或收到 new-context 请求，循环可在 turn 中途 compact 后继续。", "当 needs_follow_up 为 false 时，stop hook 仍可能阻止结束并注入 continuation。这使质量门槛可以位于模型循环之外，但也意味着 hook 必须有清晰的终止条件，否则会制造隐藏循环。TurnComplete 只能在这些继续来源都被耗尽后产生。"] },
      { number: "3.3", title: "retry、follow-up、steer 与 cancel 不能混为一谈", paragraphs: ["transport retry 应复用同一次 sampling 意图，不能重新执行已经完成的工具；follow-up 是获得新证据后的下一次模型决策；steer 是用户在 active turn 中追加输入；cancel 则停止未完成的工作并发出中断语义。", "工具取消不是数据库事务回滚。命令可能已经写文件或调用外部系统，runtime 只能在 future 尚未完成时中止等待并合成 aborted output。设计可恢复工具时应依赖幂等键、状态查询或补偿动作，而不是假设 Cancel 会撤销世界。"] },
      { number: "3.4", title: "pre-sampling compaction 存在可见的估算边界", paragraphs: ["源码在 pre-sampling compaction 旁保留 TODO：当前估算尚未完整包含 pending context 与即将加入的 user input。也就是说，压缩触发不是纯粹精确的 token 证明，而是策略与估算。", "对架构师而言，这要求将 compaction failure 视为控制流的一部分：既要避免窗口超限，也不能过早丢失关键证据。测试应覆盖新输入刚好跨阈值、模型切换导致 window 改变、以及 mid-turn tool output 很大的情况。"] },
    ],
    codeReading: { title: "跟一遍 run_turn", steps: ["在主循环前标出所有 one-time preparation。", "找到 history.for_prompt 与 run_sampling_request。", "记录 model_needs_follow_up、has_pending_input 与 should_roll_over。", "再追 stop hook 和 TurnComplete 的发出位置。"] },
    invariants: ["一次 Turn 可包含多次模型请求。", "transport retry 不得重复已完成副作用。", "取消不等于回滚外部世界。"],
    reviewQuestions: ["哪些条件会让 Turn 在模型不再调用工具后仍继续？", "为什么 tool cancellation 不能提供事务语义？", "pre-sampling compact 的 TODO 会产生什么边界案例？"],
    evidence: [
      { label: "Turn preparation", path: "codex-rs/core/src/session/turn.rs", lines: [145, 260], proves: "compaction、MCP、StepContext 与输入准备发生在主循环前后。" },
      { label: "Follow-up decision", path: "codex-rs/core/src/session/turn.rs", lines: [399, 510], proves: "模型、pending input、rollover 与 stop hook共同决定继续。" },
      { label: "Sampling loop", path: "codex-rs/core/src/session/turn.rs", lines: [2240, 2605], proves: "流式响应、工具结果与 needs_follow_up 聚合。" },
      { label: "Tool cancellation", path: "codex-rs/core/src/tools/parallel.rs", lines: [70, 151], proves: "cancel select 在完成结果和 aborted 合成结果之间选择。" },
    ],
  },

  "context-management": {
    id: "context-management",
    objectives: ["区分 canonical history、in-memory context 与 model-visible projection", "理解 normalization、truncation、compaction 和 world-state diff", "评估 context cache、准确性与 token 成本之间的权衡"],
    diagram: {
      title: "Context 的四个真相层级",
      caption: "越向右越接近模型，但也越有损。模型看到的是为当前能力和窗口投影后的视图，而不是完整 rollout。",
      lanes: [
        { label: "CANONICAL", nodes: ["rollout items", "full tool outputs", "user events", "replay evidence"] },
        { label: "IN-MEMORY", nodes: ["ContextManager", "history_version", "token_info", "world baseline"] },
        { label: "PROJECTION", nodes: ["normalize pairs", "strip modality", "truncate output", "for_prompt"] },
        { label: "LOSSY CONTINUITY", nodes: ["compact summary", "reference context", "world diff", "next sampling"] },
      ],
    },
    sections: [
      { number: "4.1", title: "ContextManager 管理的是可演化历史，不是一段字符串", paragraphs: ["ContextManager 保存 ResponseItemEnvelope 列表、history_version、token_info、reference_context_item 和 world_state_baseline。记录新 item 时它维护调用与输出的结构关系；生成 prompt 时再根据模型支持的输入模态创建投影。", "这种表示允许 tool calls、reasoning、messages、world state 和引用上下文保持类型信息，也允许 rollout 与 prompt 使用不同形态。代价是每个变换都必须维持配对不变量，否则模型可能看到 orphan tool output 或缺少调用结果。"] },
      { number: "4.2", title: "normalization 是协议修复，不是语义校验", paragraphs: ["normalize_history 会确保每个 call 都有 output、移除孤立的 paired output，并剥离模型不支持的 image/audio。工具输出还会按 truncation policy 进行预算裁剪，并为序列化开销留出余量。", "这些规则保证请求在结构上可发送，却不能判断被截断部分是否恰好包含关键错误。accuracy 因此不能只靠 context manager；工具应把最重要的结论、exit status 与定位信息放在稳定头部，超大原始产物应保存在文件并通过摘要引用。"] },
      { number: "4.3", title: "world state 用 baseline + diff 控制重复注入", paragraphs: ["每个 step 可捕获新的 world state，与 baseline 比较后写入 full 或 patch。这样避免每轮重复发送不变环境，也使 rollout 能解释模型当时看到的世界变化。若 rollback 裁剪破坏了混合 bundle，ContextManager 会清空 reference baseline，迫使后续重新注入完整上下文。", "这是 cache efficiency 与可恢复性之间的典型 trade-off：稳定 prefix 能提高 prompt cache 命中，但 patch 链太长或 baseline 丢失会降低可理解性。设计新 context fragment 时，应遵守仓库约束：有硬上限、单项不超过 10K tokens，并用 core/context 中的结构体定义。"] },
      { number: "4.4", title: "compaction 保连续性，但不保逐字事实", paragraphs: ["context window 同时跟踪模型完整窗口和 auto-compact scope；scope 可以是 Total，也可以只计算固定 prefix 之后的 body。剩余 token 取 scope 与 full window 的更紧限制，所以即使可压缩 body 尚有空间，模型硬窗口仍是最终上限。", "compaction 用摘要替换较老上下文，属于有损变换。它适合保留目标、决策与未完成事项，不适合充当审计记录。需要精确恢复时应回到 canonical rollout 或工作区文件；需要当前决策时才使用 compacted prompt view。"] },
      { number: "4.5", title: "架构 trade-off：稳定 prefix、及时更新、低 token 三者冲突", paragraphs: ["频繁重写前缀会造成 cache miss；不更新会让模型基于陈旧环境；持续追加又会逼近窗口。Codex 的方向是增量历史、受限注入、world diff 与必要时 compaction，而不是每轮从零重建完整 prompt。", "新增自动注入项时，最关键的问题不是“它有帮助吗”，而是变化频率、最大尺寸、是否可从文件重新读取、被压缩后如何恢复，以及它是否会在每个 turn 重复污染 prefix。大于 1K tokens 的新增 context item 按仓库规则应获得 P0 manual review。"] },
    ],
    codeReading: { title: "从事实到 prompt", steps: ["先读 ContextManager 字段和 record_items。", "跟 for_prompt 进入 normalize_history 与 output truncation。", "检查 world_state baseline/diff 和 rollback 行为。", "再读 context_window 的 Total/BodyAfterPrefix 预算。"] },
    invariants: ["history 增量构建，不重写 canonical 过去。", "每个自动注入项必须有硬上限。", "prompt projection 可有损，但调用/输出配对必须完整。", "compaction 不能替代 canonical replay。"],
    reviewQuestions: ["为什么 for_prompt 不能直接返回 rollout items？", "world-state baseline 何时必须失效？", "稳定 prefix、及时更新和 token 成本如何相互冲突？", "哪类信息不应只存在 compact summary 中？"],
    evidence: [
      { label: "Context state", path: "codex-rs/core/src/context_manager/history.rs", lines: [46, 68], proves: "history、token、reference 与 world baseline 的字段。" },
      { label: "Prompt projection", path: "codex-rs/core/src/context_manager/history.rs", lines: [164, 223], proves: "record 与 for_prompt 的分离。" },
      { label: "Normalization", path: "codex-rs/core/src/context_manager/history.rs", lines: [453, 519], proves: "调用配对、模态过滤与工具输出截断。" },
      { label: "Rollback", path: "codex-rs/core/src/context_manager/history.rs", lines: [522, 566], proves: "裁剪可能使 reference baseline 失效。" },
      { label: "Repository constraints", path: "AGENTS.md", lines: [91, 100], proves: "增量、cache、上限与人工评审不变量。" },
    ],
  },

  "model-flexibility": {
    id: "model-flexibility",
    objectives: ["理解 model catalog、ModelInfo、provider transport 和 turn session 的分层", "区分模型可配置性与语义可替换性", "识别缓存、fallback 和 WebSocket 状态的边界风险"],
    diagram: {
      title: "从模型目录到一次 Turn 的模型会话",
      caption: "catalog 决定有哪些模型和能力；TurnContext 决定本轮选谁；ModelClientSession 持有本轮传输状态。三者生命周期不同。",
      lanes: [
        { label: "DISCOVERY", nodes: ["bundled models", "disk cache", "remote /models", "auth visibility"] },
        { label: "CAPABILITIES", nodes: ["ModelInfo", "context window", "modalities", "reasoning / tiers"] },
        { label: "TURN POLICY", nodes: ["requested model", "config overrides", "fallback policy", "TurnContext"] },
        { label: "TRANSPORT", nodes: ["ModelClient", "ModelClientSession", "WebSocket / HTTP", "turn-state header"] },
      ],
    },
    sections: [
      { number: "5.1", title: "ModelsManager 是能力目录，不是请求客户端", paragraphs: ["OpenAiModelsManager 合并二进制内置模型、磁盘缓存与远端 /models 返回，并依据认证方式和 visibility 过滤。RefreshStrategy 允许 Online、Offline 或仅在无缓存时 Online，使 CLI 在离线启动与远端更新之间取得平衡。", "ModelInfo 不只是名称：它携带 context window、输入模态、truncation、reasoning、service tier、instructions 与能力开关。下游 context 和 tool advertisement 必须根据这些字段构造请求，因此新增模型不应只在 UI 下拉框加一个字符串。"] },
      { number: "5.2", title: "ModelClient 与 ModelClientSession 分离生命周期", paragraphs: ["ModelClient 保存 thread 稳定的 provider、auth、transport 与 fallback 配置；ModelClientSession 是 turn-scoped，懒建 WebSocket、记录 last request，并保持 x-codex-turn-state 等 sticky state。源码明确警告不要跨 turn 复用 session。", "这个分层避免传输状态污染后续 Turn，也允许 WebSocket 不可用时回退 HTTP。相反，如果把 session 放进全局连接池，模型服务端的 turn state、重试游标或流状态可能错误地泄漏到另一条用户意图。"] },
      { number: "5.3", title: "模型选择灵活，不代表模型语义等价", paragraphs: ["provider wire compatibility 只保证请求能够发送。不同模型对 tool schema、并行调用、图像输入、reasoning summary、指令服从和长上下文的行为可能不同。Codex 因此把能力放入 ModelInfo，并在 ContextManager.for_prompt 时按模态投影。", "fallback 也不是纯可用性开关。将不可用的 requested model 替换为另一模型可能改变准确性、成本和工具行为；对要求可复现的 benchmark、review 或安全任务，应把实际模型记录为 evidence，并决定 fallback 是允许、提示还是禁止。"] },
      { number: "5.4", title: "缓存的隐藏维度：provider identity", paragraphs: ["模型目录缓存提高启动速度并支持离线，但源码保留 TODO：缓存 eligibility 尚未完整包含 provider identity。若用户切换兼容 provider，旧缓存可能被错误复用。", "这是典型的 cache key completeness 问题。任何影响 model semantics、可见性或 endpoint contract 的维度都应进入 key 或 invalidation 策略。测试不能只覆盖 ETag 命中，还要覆盖 auth 类型切换、provider 切换、remote source-of-truth 和 config override。"] },
    ],
    codeReading: { title: "沿模型选择路径阅读", steps: ["从 ModelsManager::list_models 和 RefreshStrategy 看目录来源。", "展开 ModelInfo，标出所有影响 prompt/tool 的能力字段。", "从 TurnContext 的 model 选择跟到 ModelClient。", "检查 ModelClientSession 的 WebSocket、fallback 与 sticky state。"] },
    invariants: ["模型 capability 来自结构化 ModelInfo，而非名字推断。", "ModelClientSession 不跨 Turn 复用。", "实际使用的模型必须可观测，尤其在 fallback 后。"],
    reviewQuestions: ["为什么模型下拉框不是完整的模型抽象？", "跨 Turn 复用 WebSocket session 可能泄漏什么？", "provider identity 为什么应该影响缓存？"],
    evidence: [
      { label: "Refresh strategies", path: "codex-rs/models-manager/src/manager.rs", lines: [56, 77], proves: "在线、离线与按需刷新策略。" },
      { label: "Catalog state", path: "codex-rs/models-manager/src/manager.rs", lines: [205, 286], proves: "bundled/cache/remote 与 ETag 的组合。" },
      { label: "Model capabilities", path: "codex-rs/models-manager/src/model_info.rs", lines: [1, 180], proves: "context、truncation 与配置覆盖。" },
      { label: "Turn-scoped transport", path: "codex-rs/core/src/client.rs", lines: [240, 320], proves: "ModelClientSession 的生命周期和状态。" },
    ],
  },

  "tool-runtime": {
    id: "tool-runtime",
    objectives: ["理解从 tool spec 到 handler result 的完整路径", "区分并行安全、执行成功和任务正确", "掌握 StepContext、cancellation 与 hook 的边界"],
    diagram: {
      title: "工具从声明到反馈的执行管线",
      caption: "模型只产生结构化意图。真正的副作用由 router、并发门、policy、sandbox 和 handler 共同决定；结果再变成下一次 sampling 的输入。",
      lanes: [
        { label: "ADVERTISE", nodes: ["ToolSpec", "schema", "StepContext registry", "model-visible set"] },
        { label: "ROUTE", nodes: ["Response call", "ToolCall", "ToolRouter", "handler lookup"] },
        { label: "GOVERN", nodes: ["read/write lock", "approval", "permission profile", "sandbox"] },
        { label: "FEEDBACK", nodes: ["handler result", "post-tool hooks", "ResponseItem output", "next sampling"] },
      ],
    },
    sections: [
      { number: "6.1", title: "Tool spec 是模型能力快照，不是动态菜单", paragraphs: ["每次 StepContext 构建本次模型可见的 registry 和 schema。模型根据这个集合生成 FunctionCall、ToolSearchCall 或 CustomToolCall；ToolRouter 再把它们转换为内部 ToolCall，并使用同一个 StepContext 的 registry 分发。", "如果执行阶段重新读取全局注册表，就可能执行模型当时未看到、参数契约已变化的 handler。保留 StepContext 让异步调用在能力发现与执行之间保持一致，也是插件、MCP 和 code mode 动态能力的关键边界。"] },
      { number: "6.2", title: "RwLock 表达 effect ordering，而不只是性能优化", paragraphs: ["ToolCallRuntime 使用共享 RwLock：声明为 parallel-safe 的调用取得 read lock，可以并发；非并行调用取得 write lock，与其他调用互斥。这不是简单的吞吐开关，它编码了对工作区和外部世界副作用顺序的假设。", "把写文件或依赖 shell 当前状态的工具错误标记为 parallel-safe，可能产生难以复现的竞态。反过来全部串行则牺牲独立搜索、读取和网络调用的延迟。新工具需要用 effect model 说明读写集合、幂等性和可取消性。"] },
      { number: "6.3", title: "非 fatal tool error 会回到模型，而不是直接结束 Turn", paragraphs: ["registry 记录结果、日志 success 标志、metrics，并运行 post-tool hook。可恢复的 handler 错误通常转换为 success:false 的 FunctionCallOutput 或 CustomToolCallOutput，让模型有机会修正参数、选择替代工具或向用户解释。fatal error 才会终止控制流。", "这里的 success 只说明 handler contract，不说明用户目标正确完成。exit code 0 的命令仍可能修改错文件；返回 JSON 的 API 仍可能提供过期数据。工具结果应包含可供下一层验证的证据，而不是只有布尔值。"] },
      { number: "6.4", title: "取消只决定等待结果的方式", paragraphs: ["并发 runtime 在 cancellation 与 tool future 之间 select。若 future 已产生 terminal outcome，就保留真实结果；否则中止并合成 aborted response，同时发送相应通知。这个边界减少重复报告，但无法撤销已发生的副作用。", "需要 exactly-once 或可补偿语义的外部工具，应在 handler 层增加 idempotency key、operation id 与 read-after-write verification。agent loop 的 cancellation token 只能提供协作式停止，不能替代业务事务。"] },
    ],
    codeReading: { title: "跟一个工具调用", steps: ["从 tool spec 构建处确认模型实际看到的 schema。", "在 router.rs 看三类 response call 如何归一化。", "在 parallel.rs 检查锁模式与 cancel select。", "在 registry.rs 看结果、metrics、hook 和 fatal/nonfatal 分支。"] },
    invariants: ["执行使用模型采样时的 StepContext。", "并行标记是副作用语义，不只是性能选项。", "tool success 不等于任务正确。", "cancel 不回滚已发生副作用。"],
    reviewQuestions: ["为什么动态 registry 必须在 step 边界冻结？", "read/write lock 分别表达什么工具语义？", "为什么非 fatal error 应作为模型可见输出？"],
    evidence: [
      { label: "Tool routing", path: "codex-rs/core/src/tools/router.rs", lines: [1, 180], proves: "多类模型调用归一化并按 StepContext 分发。" },
      { label: "Parallel gate", path: "codex-rs/core/src/tools/parallel.rs", lines: [35, 100], proves: "RwLock 读写模式编码并发安全。" },
      { label: "Cancellation", path: "codex-rs/core/src/tools/parallel.rs", lines: [100, 170], proves: "完成结果与 aborted 合成结果的竞态处理。" },
      { label: "Registry lifecycle", path: "codex-rs/core/src/tools/registry.rs", lines: [180, 360], proves: "handler、日志、指标与 post-tool hook。" },
      { label: "Extraction boundary", path: "codex-rs/tools/README.md", lines: [1, 75], proves: "共享 host 类型正在抽取，Session orchestration 仍在 core。" },
    ],
  },

  accuracy: {
    id: "accuracy",
    objectives: ["把 accuracy 拆成可验证的 assurance stack", "区分结构正确、执行成功、行为正确与目标正确", "设计贯穿模型—工具—测试—review 的证据链"],
    diagram: {
      title: "Accuracy assurance stack",
      caption: "越向下越接近用户目标，但成本更高。上层通过不代表下层自动通过。",
      lanes: [
        { label: "STRUCTURE", nodes: ["JSON schema", "typed protocol", "call/output pairing", "parse success"] },
        { label: "EXECUTION", nodes: ["handler success", "exit status", "sandboxed action", "recorded output"] },
        { label: "BEHAVIOR", nodes: ["focused test", "build / lint", "diff review", "runtime assertion"] },
        { label: "GOAL", nodes: ["user intent", "domain oracle", "review agent", "human acceptance"] },
      ],
    },
    sections: [
      { number: "7.1", title: "Codex 没有一个叫 AccuracyManager 的真相模块", paragraphs: ["准确性来自多层 contract：protocol/schema 限制形状，ContextManager 保持历史结构，工具把外部事实带回模型，编译与测试检查部分行为，review 或领域 oracle 判断结果是否满足目标。每一层只证明自己的命题。", "因此 TurnComplete 只说明控制循环结束；tool success 只说明 handler 返回成功；test pass 只说明被执行的断言通过。架构评审应明确最终 claim 依赖哪一层 evidence，并报告未覆盖边界。"] },
      { number: "7.2", title: "反馈质量决定模型是否能自我修正", paragraphs: ["agent 的优势不是第一次输出必然正确，而是能观察 action result 并迭代。高质量工具输出要包含 command、target、exit status、关键 stderr、变更摘要和可定位产物；模糊的“失败了”会迫使模型猜测。", "Context truncation 又会削弱反馈，因此稳定摘要应放在输出开头，大型日志放文件并给路径。对外部 API，最好同时返回 operation id 和随后查询到的状态，从而区分 request accepted 与 effect observed。"] },
      { number: "7.3", title: "验证必须贴近风险，而不是统一跑一个大测试", paragraphs: ["代码修改的证据链通常是：静态类型/格式 → 受影响单测 → 集成路径 → diff 自审 → 必要时真实环境 smoke。工具和协议改动还要验证事件顺序、取消、重试以及旧客户端兼容。", "大而全的 test suite 可能被已有环境问题阻塞，也可能掩盖与改动无关的失败。runtime 应记录精确命令、结果和剩余 gap；这比一个无上下文的绿色标志更能支撑准确性判断。"] },
      { number: "7.4", title: "第二判断者有价值，但不是自动真相", paragraphs: ["review agent、guardian 或 stop hook 能捕捉遗漏，尤其适合检查 diff、计划覆盖与安全风险。但它们仍是模型判断，可能共享同一盲点。", "高风险任务应把 reviewer 绑定到不同 evidence surface，例如实际测试输出、git diff、部署状态或领域规则。multi-agent 子任务完成也不能直接转化为 parent 的 verified claim；主控制面必须整合结果并处理冲突。"] },
      { number: "7.5", title: "Observability is split between SessionTelemetry and subsystem metrics", paragraphs: ["codex-otel owns exporter wiring, traces, low-level metrics, and trace-context propagation. SessionTelemetry adds consistent conversation/model/auth/source metadata to business events. Subsystem-owned audit events can stay in their own crate. This avoids forcing every metric through Session, while preserving a shared session identity for end-to-end analysis.", "The core integration suite is organized around runtime behavior, not only isolated units: approvals, compaction, resume/fork, model switching, MCP refresh, prompt caching, tool lifecycle, WebSocket fallback, and sandbox policy each have dedicated modules. This test architecture is part of the design because many invariants cross crate boundaries and cannot be proven by a handler unit test." ] },
    ],
    codeReading: { title: "寻找准确性证据", steps: ["从 response schema 看结构能证明什么。", "跟 ToolRouter 结果如何回到 history。", "检查 TurnComplete 的条件，确认它没有目标正确性语义。", "再看 integration tests 是否覆盖实际事件链。"] },
    invariants: ["每个成功状态必须说明其证明范围。", "模型应看到可定位、可复查的工具反馈。", "最终 claim 需要与风险相称的外部 evidence。"],
    reviewQuestions: ["schema validation 能证明哪些事，不能证明哪些事？", "为什么 exit code 0 仍不足以证明任务完成？", "review agent 如何避免只重复主模型的盲点？"],
    evidence: [
      { label: "Tool result feedback", path: "codex-rs/core/src/tools/registry.rs", lines: [250, 390], proves: "结果、success logging 与 hook 构成反馈链。" },
      { label: "Turn completion", path: "codex-rs/core/src/session/turn.rs", lines: [425, 520], proves: "完成由 follow-up/input/hook 控制，不含目标 oracle。" },
      { label: "External status projection", path: "codex-rs/app-server/src/bespoke_event_handling.rs", lines: [1482, 1542], proves: "Completed/Failed/Interrupted 是事件和摘要的投影。" },
      { label: "Integration preference", path: "AGENTS.md", lines: [112, 120], proves: "agent logic changes 优先使用 core/suite 集成测试。" },
      { label: "Telemetry ownership", path: "codex-rs/otel/README.md", lines: [1, 9], proves: "OTEL provider, SessionTelemetry, metrics, and trace context are separate APIs." },
      { label: "Business-event boundary", path: "codex-rs/otel/README.md", lines: [74, 104], proves: "SessionTelemetry owns session events while subsystems may own audit events." },
      { label: "Integration suite map", path: "codex-rs/core/tests/suite/mod.rs", lines: [36, 180], proves: "cross-cutting runtime behaviors are verified as dedicated integration modules." },
    ],
  },

  safety: {
    id: "safety",
    objectives: ["区分 approval、permission profile、sandbox 与 network policy", "理解 intent authorization 与 technical enforcement 的组合", "识别 discovery、trust 和 execution policy 的边界"],
    diagram: {
      title: "副作用执行前的安全决策",
      caption: "任何单层通过都不足以放行。最终决策同时考虑命令解析、规则、用户审批策略、权限 profile、项目 trust 和实际 sandbox backend。",
      lanes: [
        { label: "INTENT", nodes: ["model tool call", "command parse", "policy rules", "risk classification"] },
        { label: "AUTHORIZATION", nodes: ["AskForApproval", "granular flags", "user decision", "project trust"] },
        { label: "ENFORCEMENT", nodes: ["PermissionProfile", "filesystem policy", "network policy", "sandbox backend"] },
        { label: "OUTCOME", nodes: ["skip", "needs approval", "forbidden", "execute + observe"] },
      ],
    },
    sections: [
      { number: "8.1", title: "Approval 回答“是否允许”，sandbox 回答“能否越界”", paragraphs: ["AskForApproval 决定何时向用户请求意图授权；PermissionProfile 与 sandbox backend 对文件系统、进程和网络施加技术限制。用户允许执行一条命令，不等于命令获得无限主机权限；反过来沙箱可安全容纳的动作，也可能因用户策略要求而必须审批。", "exec_policy 将 command parse、规则决策、approval policy、permission profile、sandbox override、project trust 和平台能力合并。若规则要求 prompt 但 policy=Never，或系统没有实际保护能力，代码选择 Forbidden，而不是静默降级为执行。"] },
      { number: "8.2", title: "Granular approval 使授权原因成为一等信息", paragraphs: ["OnRequest、UnlessTrusted、Never 和 Granular 不只是 UI 模式。Granular 可以分别控制 sandbox approval 与 rule-based approval，使 runtime 区分“命令请求越过沙箱”和“规则判定需要人类确认”。", "这要求 approval event 带上 reason、可用决策和请求上下文；客户端只显示一个通用确认框会丢失安全语义。协议改动必须同时验证 core event、app-server projection 和各客户端交互。"] },
      { number: "8.3", title: "Project trust 与能力发现都不是授权替代品", paragraphs: ["trusted project 可以改变默认审批策略，但不能让危险命令绕过实际 sandbox 判定。类似地，UI 是否展示某个 tool、plugin 或 MCP 只是 discovery；如果直接按 slug 或名称调用的 server-side 入口缺少校验，隐藏列表并不能阻止执行。", "安全评审要沿真实调用链闭环：从模型可见 spec 到 router、handler、exec policy、sandbox backend 和外部 effect。只审查 catalog/filter 容易把可发现性误当成权限边界。"] },
      { number: "8.4", title: "网络是独立 effect surface", paragraphs: ["文件系统限制不能自动约束网络数据外传，网络 proxy/approval 也不能阻止本地危险写入。两类 effect 需要独立 policy 和审计字段。", "组合工具尤其危险：一个只读文件工具加一个网络工具可以共同形成数据外传路径。StepContext 的 capability set、approval reason 和 post-tool evidence 必须允许审计这种跨工具链。"] },
      { number: "8.5", title: "SandboxPolicy maps to different OS backends", paragraphs: ["On macOS, Seatbelt consumes the resolved SandboxPolicy and protects writable roots while keeping .git and .codex read-only. On Linux, legacy-compatible policies may use Landlock; split filesystem policies that need exact denied/read-only/writable carve-outs route through bubblewrap. WSL1 fails before entering the unsupported bubblewrap path.", "Windows has elevated and unelevated backends with different enforcement ranges. A split policy is accepted only if the selected backend can enforce it directly or if it round-trips through the legacy SandboxPolicy without changing meaning. Unsupported carve-outs fail closed. The portable contract is the resolved permission policy; the enforcement mechanism is platform-specific and must be tested separately." ] },
    ],
    codeReading: { title: "沿一次 exec 决策阅读", steps: ["从 shell tool 进入 ExecApprovalRequest。", "列出 exec_policy 合并的每个输入。", "分别跟 NeedsApproval、Forbidden 和 Skip 分支。", "确认实际平台 sandbox 与网络策略在哪里执行。"] },
    invariants: ["approval 是意图授权，sandbox 是技术执行边界。", "缺少所需保护时应 forbidden，而非静默降级。", "discovery/filter 不能充当 authorization。"],
    reviewQuestions: ["为什么用户点击允许后仍需要 sandbox？", "AskForApproval::Never 遇到强制 prompt 规则时应发生什么？", "隐藏一个 MCP tool 为什么不能修复直接调用绕过？"],
    evidence: [
      { label: "Policy inputs", path: "codex-rs/core/src/exec_policy.rs", lines: [150, 240], proves: "approval 与 permission profile 作为不同输入。" },
      { label: "Decision mapping", path: "codex-rs/core/src/exec_policy.rs", lines: [317, 430], proves: "Forbidden、NeedsApproval 与 Skip 的组合逻辑。" },
      { label: "Protection fallback", path: "codex-rs/core/src/exec_policy.rs", lines: [730, 835], proves: "approval policy、trust 与实际 sandbox 能力共同决定结果。" },
      { label: "Approval events", path: "codex-rs/core/src/session/mod.rs", lines: [2469, 2668], proves: "执行/patch/permission 请求进入 Session 事件流。" },
      { label: "macOS Seatbelt", path: "codex-rs/core/README.md", lines: [23, 35], proves: "Seatbelt enforces resolved filesystem and network policy on macOS." },
      { label: "Linux backend selection", path: "codex-rs/core/README.md", lines: [37, 63], proves: "policy shape selects Landlock or bubblewrap and unsupported WSL1 fails early." },
      { label: "Windows fail-closed rules", path: "codex-rs/core/README.md", lines: [65, 92], proves: "Windows backends accept only policy shapes they can preserve." },
    ],
  },

  "persistence-memory": {
    id: "persistence-memory",
    objectives: ["区分 canonical rollout、metadata projection 与 derived memory", "理解 history-first 写入和 metadata repair 的一致性模型", "分析两阶段 memory pipeline 的准确性与安全边界"],
    diagram: {
      title: "Persistence 与 Memory 的 truth hierarchy",
      caption: "左侧保存发生过的事件，右侧逐步增加检索效率和语义浓缩，同时降低原始事实保真度。Memory 只能辅助，不应覆盖当前 workspace 与用户输入。",
      lanes: [
        { label: "CANONICAL", nodes: ["Session events", "ResponseItems", "append_items", "rollout JSONL"] },
        { label: "QUERY PROJECTION", nodes: ["observe items", "metadata patch", "SQLite index", "sync / repair"] },
        { label: "STAGE 1", nodes: ["eligible rollouts", "bounded extraction", "raw memory", "rollout summary"] },
        { label: "STAGE 2", nodes: ["global lock", "top-N selection", "workspace diff", "MEMORY consolidation"] },
      ],
    },
    sections: [
      { number: "9.1", title: "ThreadStore 明确拆开 history append 与 metadata update", paragraphs: ["ThreadStore::append_items 是原始 canonical history 的追加 API，不负责从 items 猜测标题、cwd 或 archive 状态；ThreadStore::update_thread_metadata 是唯一 metadata 写入口。LocalThreadStore 用 rollout JSONL 保存历史，用 SQLite 保存可查询投影。", "拆分避免底层 store 偷偷改变业务语义，也使 migration 和 repair 更可控。代价是调用方必须显式维护 metadata；若只追加 history 而漏掉 patch，列表页可能暂时显示旧状态，但回放事实仍然存在。"] },
      { number: "9.2", title: "LiveThread 采用 history-first，而不是伪原子双写", paragraphs: ["LiveThread 的写序是：先 append canonical history，再 observe items，最后应用显式 metadata patch。这一选择优先保证不可替代的事件事实；metadata 若失败可以从 history 或上层状态重新同步。", "这不是跨 JSONL 与 SQLite 的数据库事务，因此读模型允许短暂滞后。客户端与运维工具要区分“thread 没有发生”与“metadata projection 尚未追上”，并提供 sync/repair 路径，而不是回滚已经记录的 history。"] },
      { number: "9.3", title: "Memory 是后台派生管线，不在 Turn 热路径上", paragraphs: ["memory 仅在 root、non-ephemeral、功能启用且 state DB 可用时运行，并作为异步后台任务启动。Phase 1 按 idle/age/source/lease 等条件选择 rollout，以固定并发上限提取 raw_memory、rollout_summary 和 slug，做 secret redaction 后写 DB，并对失败 backoff。", "把它移出热路径保护交互延迟和 Turn 可用性；缺点是新记忆不会立即可见。依赖 memory 的行为必须接受 eventual consistency，不能把“刚完成的 thread 一定已经进入记忆”当作 contract。"] },
      { number: "9.4", title: "Phase 2 用全局串行换取共享文件一致性", paragraphs: ["Phase 2 获取全局锁，从 stage-1 记录按使用次数、新近使用和生成时间选择 top-N，同步 raw_memories、rollout summaries 与 workspace diff，再启动受限 consolidation agent。该 agent 禁止审批和网络，只能写 memory root，并关闭 collaboration。", "成功后 pipeline 记录选择快照与 watermark；失败则不应把新 baseline 当成已完成。全局串行降低多个 consolidation agent 覆盖同一 MEMORY 文件的风险，但也意味着高频 rollout 会排队，选择与淘汰策略直接影响长期记忆偏差。"] },
      { number: "9.5", title: "Memory accuracy 的正确定位：检索提示，不是真相层", paragraphs: ["stage-1 和 stage-2 都由模型生成，可能遗漏、误归因或随着源码变化而过期。memory 最适合提供先验导航：曾经读过哪些文件、采取过什么命令、用户有什么稳定偏好。涉及当前实现、权限或生产状态时，应回到 live source、workspace 和当前用户输入验证。", "推荐的 truth hierarchy 是：当前用户明确输入与当前工作区事实最高，其次是 canonical rollout，再次是 metadata projection，最后才是 derived memory。Memory 冲突时应被更高层证据覆盖，并保留更新/失效机制。"] },
    ],
    codeReading: { title: "从 Turn 到长期记忆", steps: ["先读 thread-store README 的两个写 API。", "在 LiveThread 跟 append → observe → patch 顺序。", "在 memories README 分别画出 Phase 1 与 Phase 2。", "最后回到 turn_processor 看 memory task 的启动条件。"] },
    invariants: ["canonical history 优先于可重建 metadata。", "memory pipeline 不阻塞 Turn 热路径。", "派生 memory 必须服从当前 source/workspace/user evidence。", "consolidation 对共享文件写入需要全局串行。"],
    reviewQuestions: ["为什么 metadata 不由 append_items 自动推断？", "history-first 双写失败时哪一层可以 repair？", "为什么 memory 不能证明当前源码事实？", "Phase 2 为什么需要 global lock？"],
    evidence: [
      { label: "Store contract", path: "codex-rs/thread-store/README.md", lines: [1, 31], proves: "canonical append 与 metadata update 分离。" },
      { label: "History-first write", path: "codex-rs/thread-store/src/live_thread.rs", lines: [1, 220], proves: "append、observe 与 metadata patch 的顺序。" },
      { label: "Memory eligibility", path: "codex-rs/memories/README.md", lines: [28, 40], proves: "后台运行的根线程、ephemeral、feature 与 DB 条件。" },
      { label: "Phase 1", path: "codex-rs/memories/README.md", lines: [40, 77], proves: "rollout 筛选、并发提取、redaction 与 DB 输出。" },
      { label: "Phase 2", path: "codex-rs/memories/README.md", lines: [79, 150], proves: "全局锁、top-N、workspace diff、受限 agent 与 watermark。" },
      { label: "Turn trigger", path: "codex-rs/app-server/src/request_processors/turn_processor.rs", lines: [609, 620], proves: "只有新 Turn 和已配置环境才可能触发后台 memory。" },
    ],
  },

  "extensions-evolution": {
    id: "extensions-evolution",
    objectives: ["区分 Skills、MCP、Plugins、Code Mode 与 multi-agent 的扩展轴", "判断一个新能力属于 context、tool、package 还是 runtime", "理解 codex-core 抽取的正确方向"],
    diagram: {
      title: "Codex 扩展面与进入 runtime 的位置",
      caption: "扩展机制解决不同问题。把所有东西都包装成 tool 会丢失生命周期与信任边界；把所有 orchestration 留在 core 又会加剧结构债务。",
      lanes: [
        { label: "INSTRUCTIONS", nodes: ["Skills", "SKILL.md", "bounded context", "prompt behavior"] },
        { label: "CAPABILITIES", nodes: ["MCP", "tools / resources", "connection lifecycle", "StepContext"] },
        { label: "PACKAGING", nodes: ["Plugins", "manifest", "discovery", "dependency bundle"] },
        { label: "ORCHESTRATION", nodes: ["Code Mode", "multi-agent", "ThreadManager", "AgentGraphStore"] },
      ],
    },
    sections: [
      { number: "10.1", title: "五种扩展机制对应五种不同 contract", paragraphs: ["Skill 主要注入受限 instructions/context；MCP 管理外部 tool/resource 与连接生命周期；Plugin 打包技能、MCP、app 等能力并参与 discovery；Code Mode 提供嵌套工具编排 runtime；multi-agent 通过 ThreadManager 创建和协调新的 Session。", "它们可以组合，但不应互相冒充。一个需要长连接和动态 resource 的能力不适合只做 Skill；一个只有写作规范的能力不需要 MCP；一个子 agent 的完成事件也不是普通 tool handler success，因为它拥有独立 thread lifecycle。"] },
      { number: "10.2", title: "能力在 StepContext 边界被冻结", paragraphs: ["Turn 可以根据输入中提到的 MCP 或 plugin 解析需要的 capability，但具体 sampling 对模型广告的工具集属于 StepContext。执行晚到的 tool call 时仍使用这份 registry。", "这给动态扩展一个清晰一致性模型：新连接或插件刷新可以影响后续 step，却不应修改已经发出的 tool schema。需要立即撤销危险能力时，应通过 cancellation/authorization 层阻止执行，而不是只从下一轮 catalog 隐藏。"] },
      { number: "10.3", title: "Multi-agent 是 Session 图，不是并行函数调用", paragraphs: ["multi-agent handler 使用 ThreadManager 创建子 Session，并可用 AgentGraphStore 保存关系。子 agent 有自己的 context、model loop、工具和完成事件；parent 需要等待、读取结果并决定是否接受。", "并行化提高吞吐和专业化，但会复制 context 成本，并引入结果冲突、取消传播与权限继承问题。completed child 只能证明子循环结束，不能证明 parent goal 已验证；最终 evidence ownership 仍在发起任务的控制面。"] },
      { number: "10.4", title: "从 codex-core 抽取要按 ownership，而不是按文件数量", paragraphs: ["仓库明确承认 codex-core 已经膨胀，并要求新概念优先复用现有专用 crate。成功的抽取应让 crate 拥有独立类型、策略和测试，例如 models-manager 管目录，thread-store 管持久化 contract。", "如果新 crate 的所有 API 都需要 &Session、&TurnContext 和 core 私有类型，它只是物理搬家，依赖方向没有改变。通常应先提炼 host-side types/adapters，再让 core 保留 orchestration；codex-rs/tools/README 描述的就是这种渐进迁移。"] },
      { number: "10.5", title: "新增能力的架构决策顺序", paragraphs: ["先问它改变的是模型知识、可调用动作、分发包装还是 agent lifecycle；再确定生命周期是 process/thread/turn/step；然后定义 discovery 与 authorization 是否分离；最后设计事件、持久化、取消和测试。", "只有完成这些问题，才能决定 folder。过早创建 crate 或 tool 往往会把 policy 藏在 handler 中，或让 app-server 直接依赖具体实现。architecture review 的目标是找到语义 owner，再让目录映射这个 owner。"] },
      { number: "10.6", title: "MCP has a connection state machine before it becomes ToolSpec", paragraphs: ["McpConnectionSet aggregates server connections, startup status, metadata, tools, resources, required/optional policy, catalog revision, filters, elicitation routing, and plugin provenance. A connection is reusable only when its connection identity and OAuth credentials still match, startup is complete, and the underlying client is not closed.", "Catalog publication has its own consistency rule. stable_catalog_revision returns None while a required connection is not ready or has closed. list_all_tools can reconnect a failed startup, use cached tools, skip unavailable optional servers, filter model visibility, attach server metadata, and normalize names. StepContext should capture a binding only after these publication rules, so model-visible ToolSpec and the client used for execution come from one catalog revision." ] },
    ],
    codeReading: { title: "为一个新能力选择落点", steps: ["写下能力的输入、输出、副作用和生命周期。", "判断它进入 prompt、tool registry、package discovery 还是 Session graph。", "检查 authorization 是否存在独立 server-side gate。", "检查是否能在不依赖 Session 私有状态下抽成 crate。", "为事件、取消、持久化与兼容性设计集成测试。"] },
    invariants: ["discovery 不等于 authorization。", "sampling 已看到的 capability set 在 StepContext 内稳定。", "子 agent 完成不等于 parent 验证。", "crate boundary 应反映 ownership 和依赖方向。"],
    reviewQuestions: ["Skill 与 MCP 的根本 contract 差异是什么？", "为什么撤销能力不能只靠从 catalog 隐藏？", "何时抽取 crate 只是物理搬家？", "multi-agent completion 为什么不是目标正确性证明？"],
    evidence: [
      { label: "Core boundary guidance", path: "AGENTS.md", lines: [72, 83], proves: "新概念应抵抗继续进入 bloated codex-core。" },
      { label: "Tool extraction", path: "codex-rs/tools/README.md", lines: [1, 75], proves: "共享类型逐步抽取，Session orchestration 留在 core。" },
      { label: "Process extension registry", path: "codex-rs/core/src/thread_manager.rs", lines: [339, 365], proves: "skills、plugins、MCP、CodeMode 与 agent graph 的共享 owner。" },
      { label: "Multi-agent spawn", path: "codex-rs/core/src/tools/handlers/multi_agents/spawn.rs", lines: [44, 139], proves: "子 agent 从当前 Turn 配置构造并通过 agent control 创建独立 thread。" },
      { label: "MCP connection lifecycle", path: "codex-rs/codex-mcp/src/connection_manager.rs", lines: [1, 220], proves: "外部 server 连接与 capability 生命周期。" },
      { label: "MCP client reuse", path: "codex-rs/codex-mcp/src/connection_manager.rs", lines: [80, 155], proves: "connection identity, OAuth state, readiness, and closure decide reuse." },
      { label: "MCP catalog publication", path: "codex-rs/codex-mcp/src/connection_manager/tool_catalog.rs", lines: [37, 165], proves: "visibility, readiness, cache, reconnect, metadata, and name normalization build the model-facing catalog." },
    ],
  },
};
