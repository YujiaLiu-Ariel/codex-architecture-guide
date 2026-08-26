import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Codex architecture learning site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>Codex Architecture Atlas<\/title>/);
  assert.match(html, /High-level architecture review/);
  assert.match(html, /Start with the whole repo/);
  assert.match(html, /DEPENDENCY DIRECTION/);
  assert.match(html, /RUNTIME LIFETIMES/);
  assert.match(html, /SOURCE VOCABULARY/);
  assert.match(html, /DEPTH &amp; COMPLETENESS AUDIT/);
  assert.match(html, /137/);
  assert.match(html, /Session actor/);
  assert.match(html, /Codex 端到端系统架构/);
  assert.match(html, /GLOBAL LAYERED ARCHITECTURE/);
  assert.match(html, /Agent runtime ownership/);
  assert.match(html, /THREAD STATE OWNER/);
  assert.match(html, /Turn execution and feedback loop/);
  assert.match(html, /EFFECT CONTROL PATH/);
  assert.match(html, /STATE CONTRACTS/);
  assert.match(html, /读完本章，你应该能够/);
  assert.match(html, /1\.5/);
  assert.match(html, /ARCHITECT REVIEW QUESTIONS/);
  assert.match(html, /Completion ≠ correctness/);
  assert.match(html, /Source ownership index/);
  assert.match(html, /d4998d6/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("includes accessible navigation and source evidence", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /aria-label="主导航"/);
  assert.match(html, /aria-label="Repository subsystem map"/);
  assert.match(html, /aria-label="Runtime lifetimes"/);
  assert.match(html, /aria-label="Architecture coverage audit"/);
  assert.match(html, /aria-label="架构专题"/);
  assert.match(html, /aria-label="开发位置索引"/);
  assert.match(html, /github\.com\/openai\/codex\/blob\/d4998d611ad37de0aa9723b6fdd2d9a2f8ff4763/);
  assert.match(html, /#L497-L638/);
  assert.match(html, /PINNED SOURCE EVIDENCE/);
});
