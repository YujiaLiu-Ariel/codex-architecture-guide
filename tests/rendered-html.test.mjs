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
  assert.match(html, /先看懂系统/);
  assert.match(html, /五层架构，一条主循环/);
  assert.match(html, /我要改什么/);
  assert.match(html, /6,667/);
  assert.match(html, /d4998d6/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("includes accessible navigation and source evidence", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /aria-label="主导航"/);
  assert.match(html, /aria-label="学习章节"/);
  assert.match(html, /aria-label="开发位置索引"/);
  assert.match(html, /github\.com\/openai\/codex\/blob\/d4998d611ad37de0aa9723b6fdd2d9a2f8ff4763/);
});

