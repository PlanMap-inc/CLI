# @planmap/connectors

Connectors turn some external reality into the **normalized facts** the engine
reasons over (`RepoStructure` + `DepFacts` from `@planmap/core`). Because the
engine is language-agnostic, adding a language or source means adding a
connector here — with **no changes to `@planmap/core`**.

## Milestone 1

- **`git` / TypeScript analyzer (ts-morph).** Compiler-grade static analysis of
  a TypeScript/JavaScript repo: derives feature/module/element units and the
  import/call dependency facts, and computes **whitespace-normalized
  fingerprints** of code ranges (the basis of drift detection).

## Roadmap

- **tree-sitter** as the universal substrate for Python, C/C++, Java, Kotlin,
  Go, Rust, … — per-language queries emitting the same `RepoStructure` +
  `DepFacts`, so the engine is unchanged.
- Cross-layer connectors: `github-org`, `postgres`, `aws`, `jenkins`, `bedrock`.

All connectors are OS-agnostic (paths via `node:path`, normalized to `/`).
