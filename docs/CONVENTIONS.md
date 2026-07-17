# PlanMap Repository Conventions

These conventions keep PlanMap consistent and easy to scale across many contributors. They are enforced by CI wherever possible.

## 1. Core-first architecture (non-negotiable)

All business logic lives in `@planmap/core` — pure TypeScript with zero dependencies on a filesystem, network, database, DOM, or editor. Surfaces (`apps/*`, `packages/ui`) only render, marshal events, and transport. A lint boundary (`eslint.config.mjs`) enforces that surfaces don't import domain/IO modules.

**Why:** one engine drives three editions (Solo/Team/Org) and four surfaces (CLI, web, VS Code, CI). They must give *identical* answers. Duplicated logic ⇒ divergent answers ⇒ lost trust.

## 2. Per-package layout

Every package/app has the same shape, so contributors learn it once:

```
<pkg>/
  src/            # source; one responsibility per folder
  README.md       # what it is, how to use it, what it depends on
  package.json    # name @planmap/<pkg>; scripts: build / test / lint / typecheck
  tsconfig.json   # extends ../../tsconfig.base.json; composite project reference
  *.test.ts       # tests colocated with the code they cover
```

## 3. Providers & connectors are pluggable

Connectors (`git`, `github-org`, `postgres`, `aws`, `jenkins`, …) and LLM providers (Anthropic, Amazon Bedrock, …) each implement a core interface and live in their own folder with a README. The engine knows only the interface — never a concrete implementation. New layer ⇒ new connector, with **no core changes**.

## 4. Determinism & honesty

- The **parser decides WHAT** (impact/drift facts); the **LLM only explains WHY**. Same input ⇒ same result on every run.
- **Uncertainty is always visible:** every edge and finding carries `confidence: "certain" | "inferred"`. Say "unsure", never guess. A confidently-wrong answer is worse than a missing one.

## 5. Data-as-truth

The `.planmap` JSON store is the single source of truth. The 2D graph and the generated markdown are *derived* views; markdown projection is **one-way** (JSON always wins on conflict).

## 6. Cross-platform / OS-agnostic

Use `node:path`, `node:fs`, `node:os`. Never hardcode path separators or shell out to OS-specific commands in product code. LF line endings everywhere (`.gitattributes`). CI runs Linux + Windows + macOS to prove it.

## 7. Commits

Conventional commits (`feat` / `fix` / `chore` / `docs` / `test` / `ci`), atomic, tested. CI (typecheck, lint, format, test, build) is the gate.
