"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SOURCE_COMMIT,
  SOURCE_ROOT,
  architectureLayers,
  chapters,
  locatorEntries,
  type Chapter,
} from "./guide-data";

const PROGRESS_KEY = "codex-architecture-atlas:progress";
const THEME_KEY = "codex-architecture-atlas:theme";

function sourceUrl(path: string) {
  return `${SOURCE_ROOT}/${path}`;
}

function ChapterDetail({
  chapter,
  complete,
  onToggleComplete,
}: {
  chapter: Chapter;
  complete: boolean;
  onToggleComplete: () => void;
}) {
  return (
    <article className="chapter-detail" aria-live="polite">
      <div className="detail-head">
        <div>
          <span className="kicker">Chapter {String(chapter.number).padStart(2, "0")} · {chapter.eyebrow}</span>
          <h3>{chapter.title}</h3>
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
      <p className="detail-intro">{chapter.description}</p>
      <div className="detail-grid">
        <div>
          <span className="detail-label">读完你应该记住</span>
          <ol className="takeaway-list">
            {chapter.takeaways.map((takeaway) => (
              <li key={takeaway}>{takeaway}</li>
            ))}
          </ol>
        </div>
        <div>
          <span className="detail-label">从这些源码开始</span>
          <div className="source-list">
            {chapter.paths.map((item) => (
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
  const [selectedChapterId, setSelectedChapterId] = useState(chapters[0].id);
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCompleted(JSON.parse(savedProgress));
      } catch {
        window.localStorage.removeItem(PROGRESS_KEY);
      }
    }

    if (savedTheme === "dark") setTheme("dark");
    if (chapters.some((chapter) => chapter.id === hashChapter)) {
      setSelectedChapterId(hashChapter);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const selectedChapter =
    chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0];

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

  const progress = Math.round((completed.length / chapters.length) * 100);

  return (
    <main>
      <nav className="topbar" aria-label="主导航">
        <a className="brand" href="#top" aria-label="Codex Architecture Atlas 首页">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>Codex Architecture Atlas</span>
        </a>
        <div className="top-links">
          <a href="#architecture">架构</a>
          <a href="#learning-path">学习路径</a>
          <a href="#locator">开发定位</a>
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
          <div className="eyebrow"><span /> SOURCE-GROUNDED FIELD GUIDE</div>
          <h1>先看懂系统，<br />再开始改代码。</h1>
          <p>
            面向第一次打开 <code>openai/codex</code> 的开发者。用一套清晰的心智模型，把 137 个 Rust workspace members
            还原成入口、协议、运行时、工具、安全与状态六条主线。
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#architecture">从架构地图开始 <span>↓</span></a>
            <a className="secondary-action" href="#locator">我想直接找代码</a>
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
              ["01", "codex", "CLI dispatch"],
              ["02", "app-server", "Thread / Turn / Item"],
              ["03", "core::session", "run_turn"],
              ["04", "model_client", "Responses stream"],
              ["05", "tool_router", "execute + return"],
              ["06", "thread_store", "persist history"],
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

      <section className="stats-strip" aria-label="仓库数据">
        <div><strong>6,667</strong><span>tracked files</span></div>
        <div><strong>137</strong><span>Rust members</span></div>
        <div><strong>3,394</strong><span>Rust sources</span></div>
        <div><strong>18</strong><span>guided chapters</span></div>
        <p>Snapshot · 2026-08-26 · <a href={`https://github.com/openai/codex/tree/${SOURCE_COMMIT}`} target="_blank" rel="noreferrer">{SOURCE_COMMIT.slice(0, 7)} ↗</a></p>
      </section>

      <section className="section architecture-section" id="architecture">
        <header className="section-head">
          <div>
            <span className="section-index">01 / SYSTEM MAP</span>
            <h2>五层架构，一条主循环</h2>
          </div>
          <p>不要从文件树开始读。先顺着一次用户请求穿过系统，再回到每一层找它的责任边界。</p>
        </header>

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
            <span>THE HEARTBEAT</span>
            <h3>一次 Turn 的真实路径</h3>
          </div>
          <div className="loop-steps" aria-label="Turn 执行步骤">
            {[
              ["01", "Prepare", "压缩历史、解析 skills 与 tools"],
              ["02", "Sample", "向 Responses API 发起流式请求"],
              ["03", "Route", "ToolRouter 识别并分派调用"],
              ["04", "Execute", "在审批与沙箱约束下执行"],
              ["05", "Continue", "工具结果进入下一次采样"],
              ["06", "Complete", "发出最终消息并持久化"],
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

      <section className="section learning-section" id="learning-path">
        <header className="section-head">
          <div>
            <span className="section-index">02 / LEARNING PATH</span>
            <h2>从陌生到可以动手</h2>
          </div>
          <div className="progress-block" aria-label={`学习进度 ${progress}%`}>
            <div><span>你的进度</span><strong>{completed.length} / {chapters.length}</strong></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </header>

        <div className="chapter-layout">
          <div className="chapter-grid" role="list" aria-label="学习章节">
            {chapters.map((chapter) => (
              <div role="listitem" key={chapter.id}>
                <button
                  type="button"
                  className={`chapter-card ${selectedChapterId === chapter.id ? "is-active" : ""} ${completed.includes(chapter.id) ? "is-complete" : ""}`}
                  onClick={() => selectChapter(chapter.id)}
                >
                  <span className="chapter-number">{String(chapter.number).padStart(2, "0")}</span>
                  <span className="chapter-copy">
                    <small>{chapter.eyebrow}</small>
                    <strong>{chapter.title}</strong>
                  </span>
                  <span className="chapter-state" aria-hidden="true">{completed.includes(chapter.id) ? "✓" : "→"}</span>
                </button>
              </div>
            ))}
          </div>

          <div id="chapter-reader" className="reader-anchor">
            <ChapterDetail
              chapter={selectedChapter}
              complete={completed.includes(selectedChapter.id)}
              onToggleComplete={() => toggleComplete(selectedChapter.id)}
            />
          </div>
        </div>
      </section>

      <section className="section locator-section" id="locator">
        <header className="section-head locator-head">
          <div>
            <span className="section-index">03 / CHANGE LOCATOR</span>
            <h2>我要改什么？</h2>
          </div>
          <p>输入功能、概念或路径。这个索引优先给你第一个应该打开的 folder，而不是把整个文件树扔给你。</p>
        </header>

        <div className="locator-shell">
          <div className="search-row">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">搜索开发位置</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如：审批、TUI、MCP、thread、Python SDK…"
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
          <span>READER RULE 01</span>
          <h3>先找边界，再看实现。</h3>
          <p>先判断需求属于客户端、协议、runtime、工具、安全还是状态层，然后才进入具体文件。</p>
        </div>
        <div className="rule-card rule-accent">
          <span>READER RULE 02</span>
          <h3>Core 不是默认答案。</h3>
          <p>仓库约定明确提醒：不要继续把新概念堆进 codex-core。优先寻找已有 crate 或稳定扩展边界。</p>
        </div>
        <div className="rule-card rule-light">
          <span>READER RULE 03</span>
          <h3>对外协议要更谨慎。</h3>
          <p>Protocol 与 app-server API 面向多个消费者。一次看似简单的字段变化，可能是破坏性变更。</p>
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
