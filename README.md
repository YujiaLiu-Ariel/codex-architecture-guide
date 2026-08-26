# Codex Architecture Atlas

A source-grounded Chinese architecture and development guide for
[`openai/codex`](https://github.com/openai/codex).

The guide is pinned to upstream commit
[`d4998d6`](https://github.com/openai/codex/tree/d4998d611ad37de0aa9723b6fdd2d9a2f8ff4763)
so every architecture claim can link to a stable source snapshot.

## What is included

- a five-layer system map
- the Thread → Turn → Tool execution lifecycle
- an 18-chapter learning path with local progress tracking
- a searchable “what should I change?” folder locator
- fixed source links for every chapter
- responsive light and dark themes

## Local development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

## Validation

```bash
npm test
npm run export:github-pages
```

The GitHub Pages artifact is written to `dist/github-pages`. Deployment is
handled by `.github/workflows/pages.yml`.

## Scope

This is an independent learning guide and is not an official OpenAI
publication. Source code remains governed by the upstream repository's license.

