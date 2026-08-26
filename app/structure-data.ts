export type RepoGroup = {
  index: string;
  name: string;
  owner: string;
  folders: string[];
  responsibility: string;
  dependsOn: string;
  startHere: string;
};

export const repoGroups: RepoGroup[] = [
  {
    index: "01",
    name: "Product surfaces",
    owner: "Input, rendering, user interaction",
    folders: ["codex-rs/cli", "codex-rs/tui", "codex-rs/exec", "sdk/typescript", "sdk/python"],
    responsibility: "Parse commands, render state, collect user input, and expose SDK APIs. These folders should not own the agent loop.",
    dependsOn: "app-server-client or an external app-server transport",
    startHere: "codex-rs/cli/src/main.rs",
  },
  {
    index: "02",
    name: "Application boundary",
    owner: "Public lifecycle and client compatibility",
    folders: ["codex-rs/app-server", "codex-rs/app-server-client", "codex-rs/app-server-protocol", "codex-rs/app-server-transport"],
    responsibility: "JSON-RPC/typed transport, initialize handshake, Thread/Turn/Item APIs, validation, config overrides, and EventMsg projection.",
    dependsOn: "codex-protocol + codex-core",
    startHere: "codex-rs/app-server/src/request_processors",
  },
  {
    index: "03",
    name: "Agent runtime",
    owner: "Thread state and the decision loop",
    folders: ["codex-rs/core", "codex-rs/core-api", "codex-rs/protocol", "codex-rs/rollout"],
    responsibility: "ThreadManagerState, CodexThread, Session, TurnContext, StepContext, run_turn, internal Submission/Op/EventMsg, and rollout events.",
    dependsOn: "models, tools, sandbox, store, MCP, plugins",
    startHere: "codex-rs/core/src/session/mod.rs",
  },
  {
    index: "04",
    name: "Model and context",
    owner: "Model capability and model-visible state",
    folders: ["codex-rs/models-manager", "codex-rs/model-provider", "codex-rs/context-fragments", "codex-rs/prompts", "codex-rs/history"],
    responsibility: "Model catalog, ModelInfo, provider transport, context-window policy, prompt projection, truncation, and compaction inputs.",
    dependsOn: "auth/config + Responses API clients",
    startHere: "codex-rs/models-manager/src/manager.rs",
  },
  {
    index: "05",
    name: "Tools and extensions",
    owner: "Capabilities advertised to the model",
    folders: ["codex-rs/tools", "codex-rs/codex-mcp", "codex-rs/skills", "codex-rs/plugin", "codex-rs/ext", "codex-rs/code-mode"],
    responsibility: "ToolSpec and handlers, MCP connections, Skill instructions, Plugin packaging, extension registration, and nested Code Mode execution.",
    dependsOn: "StepContext + authorization and execution services",
    startHere: "codex-rs/core/src/tools/router.rs",
  },
  {
    index: "06",
    name: "Execution and safety",
    owner: "Side effects and technical enforcement",
    folders: ["codex-rs/sandboxing", "codex-rs/execpolicy", "codex-rs/linux-sandbox", "codex-rs/bwrap", "codex-rs/network-proxy", "codex-rs/exec-server", "codex-rs/apply-patch"],
    responsibility: "Command policy, approval requirements, PermissionProfile enforcement, platform sandbox backends, network control, and patch execution.",
    dependsOn: "TurnContext policy + OS capabilities",
    startHere: "codex-rs/core/src/exec_policy.rs",
  },
  {
    index: "07",
    name: "State and memory",
    owner: "Replay, query projection, and derived memory",
    folders: ["codex-rs/thread-store", "codex-rs/state", "codex-rs/memories", "codex-rs/agent-graph-store", "codex-rs/history"],
    responsibility: "Rollout JSONL, SQLite metadata, thread paging/search, agent graph edges, Stage 1 extraction, and Stage 2 consolidation.",
    dependsOn: "Session events; memory additionally depends on model inference",
    startHere: "codex-rs/thread-store/README.md",
  },
  {
    index: "08",
    name: "Operations and verification",
    owner: "Evidence that the runtime behaves as designed",
    folders: ["codex-rs/otel", "codex-rs/analytics", "codex-rs/diagnostics", "codex-rs/hooks", "codex-rs/core/tests", "codex-rs/app-server/tests"],
    responsibility: "Tracing, metrics, diagnostics, lifecycle hooks, protocol integration tests, agent-loop tests, and platform-specific execution suites.",
    dependsOn: "events and stable test seams from every layer",
    startHere: "codex-rs/core/tests/suite",
  },
];

export const runtimeLifetimes = [
  { lifetime: "process", owner: "ThreadManagerState", state: "AuthManager, ModelsManager, MCP, Plugins, ThreadStore, thread map", invalidation: "process restart or manager refresh" },
  { lifetime: "connection", owner: "app-server connection", state: "initialize handshake, client capabilities, notification opt-outs", invalidation: "transport disconnect" },
  { lifetime: "thread", owner: "Session", state: "history, active turn, pending input, base config, rollout handle", invalidation: "unload, shutdown, resume/fork boundary" },
  { lifetime: "turn", owner: "TurnContext", state: "model, cwd, approval, PermissionProfile, environments, hooks", invalidation: "TurnComplete / TurnAborted" },
  { lifetime: "step", owner: "StepContext", state: "prompt view, ToolRegistry, world state, capability snapshot", invalidation: "next sampling step" },
  { lifetime: "tool call", owner: "ToolCallRuntime", state: "handler future, parallel lock, cancellation, tool output", invalidation: "terminal tool result" },
];

export const protocolMap = [
  { boundary: "Client API", input: "thread/start · turn/start", output: "Thread · Turn · Item notifications", owner: "app-server-protocol/v2" },
  { boundary: "Core control", input: "Submission<Op>", output: "Event<EventMsg>", owner: "codex-protocol" },
  { boundary: "Model API", input: "Prompt + ToolSpec", output: "ResponseItem / function call", owner: "ModelClientSession" },
  { boundary: "Tool runtime", input: "ToolCall", output: "FunctionCallOutput / CustomToolCallOutput", owner: "ToolRouter + registry" },
  { boundary: "Persistence", input: "ResponseItem + metadata patch", output: "rollout JSONL + SQLite projection", owner: "ThreadStore / LiveThread" },
];

export const coverageAudit = [
  { area: "Application boundary", level: "Deep", covered: "request validation, Thread/Turn/Item projection, command-accepted timing", gap: "full reconnect and protocol compatibility matrix" },
  { area: "Session and Turn loop", level: "Deep", covered: "ownership, submission_loop, sampling/tool feedback, steer/cancel", gap: "all Op handlers and hook variants" },
  { area: "Context management", level: "Deep", covered: "history, for_prompt, normalization, world diff, compaction", gap: "exact prompt assembly for every feature flag" },
  { area: "Models", level: "Deep", covered: "catalog, ModelInfo, cache, fallback, turn-scoped transport", gap: "provider-specific wire behavior" },
  { area: "Tools and safety", level: "Deep", covered: "routing, parallel gate, approval, PermissionProfile, cancellation", gap: "every tool handler and every OS syscall rule" },
  { area: "Persistence and memory", level: "Deep", covered: "history-first writes, metadata projection, Stage 1/2 memory", gap: "SQLite schema and migration-by-migration history" },
  { area: "Config and auth", level: "Partial", covered: "process-level ownership and per-turn overrides", gap: "config precedence, login/token refresh, enterprise policy" },
  { area: "MCP / Plugin / Code Mode", level: "Partial", covered: "responsibility and StepContext boundary", gap: "connection recovery, capability refresh, host protocol" },
  { area: "Platform sandbox", level: "Partial", covered: "approval vs enforcement and fail-closed policy", gap: "Seatbelt, Landlock/bubblewrap, Windows backend details" },
  { area: "Operations and tests", level: "Partial", covered: "accuracy evidence stack and integration-test guidance", gap: "telemetry schema, fixture architecture, release/build pipeline" },
  { area: "TUI and UI state", level: "Map only", covered: "surface ownership and app-server dependency", gap: "render/update state machine and interaction architecture" },
];

export const sourceVocabulary = [
  ["ThreadManagerState", "process-level composition root and in-memory thread registry"],
  ["CodexThread", "façade/conduit around Session and SessionIo"],
  ["Session", "thread-level state owner driven by submission_loop"],
  ["TurnContext", "effective model, cwd, permissions, environment, and hook policy for one Turn"],
  ["StepContext", "capability and world-state snapshot used by one sampling step"],
  ["Submission / Op", "commands entering codex-core"],
  ["Event / EventMsg", "facts emitted by codex-core"],
  ["ResponseItem", "typed model/history item; not the same as app-server Item"],
  ["rollout", "canonical append-only event/history record"],
  ["memory", "derived model output; useful context, not canonical state"],
] as const;
