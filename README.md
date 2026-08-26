# Codex Architecture Atlas

A source-grounded Chinese architecture and development guide for
[`openai/codex`](https://github.com/openai/codex).

The guide is pinned to upstream commit
[`d4998d6`](https://github.com/openai/codex/tree/d4998d611ad37de0aa9723b6fdd2d9a2f8ff4763)
so every architecture claim can link to a stable source snapshot.

## What is included

- a high-level architecture review with an end-to-end component diagram, strengths, structural debt, scaling pressure, and correctness boundaries
- 10 long-form architecture chapters and 10 code-native diagrams covering runtime ownership, the turn loop, context, model flexibility, tools, accuracy, safety, memory, and extensibility
- 44 numbered analysis sections with explicit mechanics, lifecycle boundaries, trade-offs, failure modes, invariants, and review questions
- 48 pinned source ranges that explain what each cited implementation proves
- a searchable source ownership index for locating the responsible crate or folder
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

## License and attribution

This guide is released under the [Apache License 2.0](LICENSE). Architecture
analysis is based exclusively on the public
[`openai/codex`](https://github.com/openai/codex) repository, which is also
licensed under Apache-2.0. Product names and trademarks belong to their
respective owners.
