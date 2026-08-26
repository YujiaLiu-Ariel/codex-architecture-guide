"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SOURCE_COMMIT,
  architectureLayers,
  architecturePressures,
  dossiers,
  locatorEntries,
  type Dossier,
} from "./guide-data";

const PROGRESS_KEY = "codex-architecture-atlas:progress";
const THEME_KEY = "codex-architecture-atlas:theme";

function sourceUrl(path: string) {
  const leaf = path.split("/").at(-1) ?? "";
  const route = path.endsWith("/") || !leaf.includes(".") ? "tree" : "blob";
  return `https://github.com/openai/codex/${route}/${SOURCE_COMMIT}/${path}`;
}

function DossierDetail({
  dossier,
  complete,
  onToggleComplete,
}: {
  dossier: Dossier;
  complete: boolean;
  onToggleComplete: () => void;
}) {
  return (
    <article className="chapter-detail" aria-live="polite">
      <div className="detail-head">
        <div>
          <span className="kicker">Dossier {String(dossier.number).padStart(2, "0")} · {dossier.domain}</span>
          <h3>{dossier.title}</h3>
        </div>
        <button
          className={complete ? "complete-button is-complete" : "complete-button"}
          onClick={onToggleComplete}
          type="button"
        >
          <span aria-hidden="true">{complete ? "✓" : "○"}</span>
          {complete ? "已读" : "标记为已读"}
        </button>
      </div>
      <p className="detail-question">{dossier.question}</p>
      <p className="detail-intro">{dossier.thesis}</p>

      <div className="call-path" aria-label="核心调用链">
        <span className="detail-label">CONTROL / DATA FLOW</span>
        <div>
          {dossier.callPath.map((step, index) => (
            <span key={step}><code>{step}</code>{index < dossier.callPath.length - 1 && <b aria-hidden="true">→</b>}</span>
          ))}
        </div>
      </div>

      <div className="mechanics-grid">
        {dossier.mechanics.map((item, index) => (
          <div className="mechanic" key={item.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
        ))}
      </div>

      <div className="tradeoff-section">
        <span className="detail-label">ARCHITECTURE TRADE-OFFS</span>
        <div className="tradeoff-table">
          <div className="tradeoff-row tradeoff-header"><span>DECISION</span><span>GAIN</span><span>COST / TENSION</span></div>
          {dossier.tradeoffs.map((item) => (
            <div className="tradeoff-row" key={item.decision}>
              <strong>{item.decision}</strong><p>{item.gain}</p><p>{item.cost}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-grid evidence-grid">
        <div>
          <span className="detail-label">FAILURE MODES TO TEST</span>
          <ul className="failure-list">
            {dossier.failureModes.map((failure) => <li key={failure}>{failure}</li>)}
          </ul>
        </div>
        <div>
          <span className="detail-label">SOURCE EVIDENCE</span>
          <div className="source-list">
            {dossier.paths.map((item) => (
              <a key={item.path} href={sourceUrl(item.path)} target="_blank" rel="noreferrer">
                <span>{item.label}</span>
                <code>{item.path}</code>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Guide() {
  const [selectedChapterId, setSelectedChapterId] = useState(dossiers[0].id);
  const [completed, setCompleted] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // This one-time hydration step restores device-local learning preferences.
  useEffect(() => {
    const savedProgress = window.localStorage.getItem(PROGRESS_KEY);
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const hashChapter = window.location.hash.replace("#chapter-", "");

    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        const validProgress = Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string" && dossiers.some((dossier) => dossier.id === id))
          : [];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCompleted(validProgress);
      } catch {
        window.localStorage.removeItem(PROGRESS_KEY);
      }
    }

    if (savedTheme === "dark") setTheme("dark");
    if (dossiers.some((dossier) => dossier.id === hashChapter)) {
      setSelectedChapterId(hashChapter);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const selectedDossier =
    dossiers.find((dossier) => dossier.id === selectedChapterId) ?? dossiers[0];

  const categories = ["全部", ...Array.from(new Set(locatorEntries.map((entry) => entry.category)))];

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return locatorEntries.filter((entry) => {
      const categoryMatches = category === "全部" || entry.category === category;
      const queryMatches =
        !normalized ||
        [entry.intent, entry.path, entry.note, entry.category]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return categoryMatches && queryMatches;
    });
  }, [category, query]);

  const selectChapter = (id: string) => {
    setSelectedChapterId(id);
    window.history.replaceState(null, "", `#chapter-${id}`);
    document.getElementById("chapter-reader")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleComplete = (id: string) => {
    setCompleted((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const progress = Math.round((completed.length / dossiers.length) * 100);

  return (
    <main>
      <nav className="topbar" aria-label="主导航">
        <a className="brand" href="#top" aria-label="Codex Architecture Atlas 首页">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>Codex Architecture Atlas</span>
        </a>
        <div className="top-links">
          <a href="#architecture">Architecture review</a>
          <a href="#dossiers">Deep dives</a>
          <a href="#locator">Source index</a>
          <button
            className="theme-toggle"
            type="button"
            aria-label={theme === "light" ? "切换到深色主题" : "切换到浅色主题"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "◐" : "◑"}
          </button>
          <a className="github-link" href="https://github.com/openai/codex" target="_blank" rel="noreferrer">
            Source ↗
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> SOURCE-GROUNDED ARCHITECTURE REVIEW</div>
          <h1>Codex runtime，<br />从边界到状态。</h1>
          <p>
            面向有 agent 开发经验的读者。这里不解释“怎么用 Codex”，而是追踪一条 Turn 如何从客户端命令进入
            <code>Session</code>，跨过 context、model、tool、approval 与 persistence，并分析每个边界背后的 trade-off。
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#architecture">Read the architecture review <span>↓</span></a>
            <a className="secondary-action" href="#dossiers">Open deep dives</a>
          </div>
        </div>

        <div className="hero-console" aria-label="Codex 运行路径摘要">
          <div className="console-bar">
            <span className="console-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>runtime.trace</span>
            <span className="live-pill">LIVE MAP</span>
          </div>
          <div className="trace-list">
            {[
              ["01", "ClientRequest", "command, not completion"],
              ["02", "app-server", "policy + protocol projection"],
              ["03", "Session actor", "state owner + event stream"],
              ["04", "run_turn", "sampling feedback loop"],
              ["05", "Action plane", "tools under policy"],
              ["06", "Durability", "history ≠ metadata ≠ memory"],
            ].map(([number, name, note], index) => (
              <div className="trace-row" key={name} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
                <span>{number}</span>
                <strong>{name}</strong>
                <em>{note}</em>
              </div>
            ))}
          </div>
          <div className="console-footer">
            <span>snapshot</span>
            <code>{SOURCE_COMMIT.slice(0, 7)}</code>
            <span className="console-status">verified from source</span>
          </div>
        </div>
      </section>

      <section className="stats-strip pressure-strip" aria-label="核心架构压力">
        {architecturePressures.map((pressure) => (
          <div key={pressure.name}>
            <strong>{pressure.name}</strong>
            <span>{pressure.thesis}</span>
            <p>{pressure.note}</p>
          </div>
        ))}
        <p className="snapshot-note">Pinned source<br /><a href={`https://github.com/openai/codex/tree/${SOURCE_COMMIT}`} target="_blank" rel="noreferrer">{SOURCE_COMMIT.slice(0, 7)} ↗</a></p>
      </section>

      <section className="section architecture-section" id="architecture">
        <header className="section-head">
          <div>
            <span className="section-index">01 / SYSTEM MAP</span>
            <h2>High-level architecture review</h2>
          </div>
          <p>先给出全局判断，再进入局部实现：Codex 是一个 event-driven、local-first 的 agent runtime；客户端通过 application boundary 共享同一控制面，执行事实通过 tool feedback 回到模型，状态则被拆成可回放、可查询和可学习三类。</p>
        </header>

        <div className="review-brief">
          <div className="review-thesis">
            <span className="detail-label">SYSTEM THESIS</span>
            <h3>它不是“LLM + 一组工具”，而是一台围绕 Session actor 构建的异步状态机。</h3>
            <p>外层将客户端命令转换为内部 Op，Session 串行管理 thread 状态，Turn loop 让模型与环境反复交换证据，最后把内部事件分别投影给客户端与持久化层。Context、model、tools、safety、memory 都是这个状态机的策略插件，而不是各自独立的产品路径。</p>
          </div>
          <div className="review-findings">
            {[
              ["Primary strength", "统一 runtime + 明确事件流", "TUI、exec 与外部客户端共享核心语义；运行状态由事件而非同步返回传播。"],
              ["Key design choice", "控制面与 action plane 分离", "Session 决定下一步；ToolRouter/handlers 在 approval、sandbox 和 cancellation 下执行副作用。"],
              ["Structural debt", "codex-core 仍有强引力", "工具、memory 等能力正在抽 crate，但依赖 Session/TurnContext 的 orchestration 仍集中在 core。"],
              ["Scaling pressure", "context 与 derived memory", "单 turn 连续性依赖有损 compaction；跨 turn 连续性依赖模型生成的、可能陈旧的 memory。"],
              ["Correctness boundary", "completion 不等于 correctness", "runtime 能证明命令、事件和工具结果发生过；任务是否正确仍需要测试、review 或领域 oracle。"],
              ["Evolution risk", "双协议 + 多投影", "内部 Op/Event 与外部 Thread/Turn/Item 有意分离，但每次新语义都需要保持翻译和客户端投影一致。"],
            ].map(([label, title, body]) => (
              <div className="review-finding" key={label}>
                <span>{label}</span><strong>{title}</strong><p>{body}</p>
              </div>
            ))}
          </div>
          <div className="review-sources">
            <span className="detail-label">HIGH-LEVEL EVIDENCE</span>
            {[
              ["Application boundary", "codex-rs/app-server/src/request_processors/"],
              ["Runtime ownership", "codex-rs/core/src/thread_manager.rs"],
              ["Session state machine", "codex-rs/core/src/session/mod.rs"],
              ["Durability contract", "codex-rs/thread-store/README.md"],
            ].map(([label, path]) => (
              <a href={sourceUrl(path)} key={path} target="_blank" rel="noreferrer"><span>{label}</span><code>{path}</code><b aria-hidden="true">↗</b></a>
            ))}
          </div>
        </div>

        <div className="layer-map">
          {architectureLayers.map((layer, index) => (
            <div className="layer" key={layer.name}>
              <div className="layer-number">{layer.index}</div>
              <div className="layer-title">
                <span>{layer.tone}</span>
                <h3>{layer.name}</h3>
              </div>
              <div className="layer-items">
                {layer.items.map((item) => <span key={item}>{item}</span>)}
              </div>
              {index < architectureLayers.length - 1 && <div className="layer-connector" aria-hidden="true">↓</div>}
            </div>
          ))}
        </div>

        <div className="loop-explainer">
          <div className="loop-title">
            <span>CONTROL + DATA FLOW</span>
            <h3>从命令受理到可恢复证据</h3>
          </div>
          <div className="loop-steps" aria-label="Turn 执行步骤">
            {[
              ["01", "Accept", "app-server 校验 request；response 仅表示 command accepted"],
              ["02", "Submit", "TurnInputRequest 转换为 Submission(Op) 进入 Session"],
              ["03", "Snapshot", "冻结 StepContext、prompt view 与 model-visible tools"],
              ["04", "Feedback", "sampling → tool execution → output 回到下一次 sampling"],
              ["05", "Project", "EventMsg 被翻译为 Thread / Turn / Item notification"],
              ["06", "Persist", "canonical history、metadata 与 derived memory 分层写入"],
            ].map(([number, title, text]) => (
              <div className="loop-step" key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <a className="inline-source" href={sourceUrl("codex-rs/core/src/session/turn.rs")} target="_blank" rel="noreferrer">
            查看 run_turn 源码 <span>↗</span>
          </a>
        </div>
      </section>

      <section className="section learning-section" id="dossiers">
        <header className="section-head">
          <div>
            <span className="section-index">02 / ARCHITECTURE DOSSIERS</span>
            <h2>沿着架构压力下钻</h2>
          </div>
          <div className="progress-block" aria-label={`学习进度 ${progress}%`}>
            <div><span>已审阅 dossiers</span><strong>{completed.length} / {dossiers.length}</strong></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </header>

        <div className="chapter-layout">
          <div className="chapter-grid" role="list" aria-label="架构专题">
            {dossiers.map((dossier) => (
              <div role="listitem" key={dossier.id}>
                <button
                  type="button"
                  className={`chapter-card ${selectedChapterId === dossier.id ? "is-active" : ""} ${completed.includes(dossier.id) ? "is-complete" : ""}`}
                  onClick={() => selectChapter(dossier.id)}
                >
                  <span className="chapter-number">{String(dossier.number).padStart(2, "0")}</span>
                  <span className="chapter-copy">
                    <small>{dossier.domain}</small>
                    <strong>{dossier.title}</strong>
                  </span>
                  <span className="chapter-state" aria-hidden="true">{completed.includes(dossier.id) ? "✓" : "→"}</span>
                </button>
              </div>
            ))}
          </div>

          <div id="chapter-reader" className="reader-anchor">
            <DossierDetail
              dossier={selectedDossier}
              complete={completed.includes(selectedDossier.id)}
              onToggleComplete={() => toggleComplete(selectedDossier.id)}
            />
          </div>
        </div>
      </section>

      <section className="section locator-section" id="locator">
        <header className="section-head locator-head">
          <div>
            <span className="section-index">03 / CHANGE LOCATOR</span>
            <h2>Source ownership index</h2>
          </div>
          <p>不是简单的目录清单：先定位行为的 owner，再沿注释中的相邻边界继续追踪。输入架构概念、失效模式或路径。</p>
        </header>

        <div className="locator-shell">
          <div className="search-row">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">搜索开发位置</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如：context、模型、memory、accuracy、approval、thread…"
              />
              {query && <button type="button" aria-label="清除搜索" onClick={() => setQuery("")}>×</button>}
            </label>
            <span className="result-count">{filteredEntries.length} results</span>
          </div>

          <div className="category-row" aria-label="按类别筛选">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? "is-active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="locator-table" role="table" aria-label="开发位置索引">
            <div className="locator-row locator-header" role="row">
              <span role="columnheader">TYPE</span>
              <span role="columnheader">CHANGE INTENT</span>
              <span role="columnheader">START HERE</span>
              <span role="columnheader">WHY</span>
            </div>
            {filteredEntries.map((entry) => (
              <a
                className="locator-row"
                role="row"
                key={`${entry.intent}-${entry.path}`}
                href={sourceUrl(entry.path.split(" · ")[0].replace("*", ""))}
                target="_blank"
                rel="noreferrer"
              >
                <span role="cell"><i>{entry.category}</i></span>
                <strong role="cell">{entry.intent}</strong>
                <code role="cell">{entry.path}</code>
                <span role="cell">{entry.note}<b aria-hidden="true">↗</b></span>
              </a>
            ))}
            {filteredEntries.length === 0 && (
              <div className="empty-state">没有匹配结果。试试更短的关键词，例如 “tool” 或 “状态”。</div>
            )}
          </div>
        </div>
      </section>

      <section className="section rules-section">
        <div className="rule-card rule-dark">
          <span>ARCHITECTURE INVARIANT 01</span>
          <h3>Command accepted ≠ work completed.</h3>
          <p>外部 request 的成功只说明命令进入 runtime；真实生命周期由后续 Event / Notification 描述。</p>
        </div>
        <div className="rule-card rule-accent">
          <span>ARCHITECTURE INVARIANT 02</span>
          <h3>History ≠ prompt ≠ memory.</h3>
          <p>发生过的 canonical items、当前模型可见视图、跨会话推导记忆有不同的一致性与准确性边界。</p>
        </div>
        <div className="rule-card rule-light">
          <span>ARCHITECTURE INVARIANT 03</span>
          <h3>Completion ≠ correctness.</h3>
          <p>控制循环结束只证明没有更多 follow-up；准确性仍取决于工具证据、测试、review 与领域约束。</p>
        </div>
      </section>

      <footer>
        <div>
          <span className="brand-mark" aria-hidden="true">C</span>
          <div><strong>Codex Architecture Atlas</strong><p>Independent learning guide. Not an official OpenAI publication.</p></div>
        </div>
        <div className="footer-links">
          <a href="https://github.com/openai/codex" target="_blank" rel="noreferrer">Source repository ↗</a>
          <a href={`https://github.com/openai/codex/tree/${SOURCE_COMMIT}`} target="_blank" rel="noreferrer">Pinned snapshot ↗</a>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
