import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const projectRoot = new URL("../", import.meta.url);
const clientRoot = new URL("../dist/client/", import.meta.url);
const outputRoot = new URL("../dist/github-pages/", import.meta.url);
const basePath = "/codex-architecture-guide/";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(clientRoot, outputRoot, { recursive: true });

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("export", String(Date.now()));
const { default: worker } = await import(workerUrl.href);

const assets = {
  async fetch(request) {
    const pathname = new URL(request.url).pathname.replace(/^\//, "");
    try {
      const body = await readFile(new URL(pathname, clientRoot));
      return new Response(body, {
        headers: { "content-type": contentTypes[extname(pathname)] ?? "application/octet-stream" },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
};

const response = await worker.fetch(
  new Request("http://localhost/", { headers: { accept: "text/html" } }),
  { ASSETS: assets },
  { waitUntil() {}, passThroughOnException() {} },
);

if (!response.ok) {
  throw new Error(`Static render failed with ${response.status}`);
}

const html = (await response.text()).replaceAll("/_next/", `${basePath}_next/`);
await writeFile(new URL("index.html", outputRoot), html);
await writeFile(new URL("404.html", outputRoot), html);
await writeFile(new URL(".nojekyll", outputRoot), "");

// Keep the Pages artifact deterministic and easy to inspect locally.
const manifest = {
  generatedFrom: "openai/codex",
  sourceCommit: "d4998d611ad37de0aa9723b6fdd2d9a2f8ff4763",
  basePath,
};
await writeFile(new URL("site-manifest.json", outputRoot), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`GitHub Pages export ready at ${join(projectRoot.pathname, "dist/github-pages")}`);

