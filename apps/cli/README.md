# @planmap/cli

The headless, agent- and CI-scriptable surface over the PlanMap engine.
Local-first, BYO-key, **never metered**. Everything runs offline; the optional
LLM only narrates the _why_ of an impact/drift finding.

## Commands

```
planmap init                 Initialize a .planmap store in the current repo
planmap map                  Analyze the repo and auto-populate the graph
planmap impact <nodeId>      What a change to a node affects, and why
planmap approve <nodeId>     Approve a node (sets the drift baseline)
planmap drift                Check approved nodes against the real code (CI-friendly exit code)
planmap handoff <nodeId>     Emit a scoped instruction for your own coding agent
planmap project              Regenerate the markdown projection of the graph
```

## The loop

`map` → `impact <id>` (review what breaks + why) → `approve <id>` → `handoff <id>`
(hand the scoped instruction to your agent) → the agent implements → `drift`
re-verifies that reality still matches what you approved.

`drift` exits non-zero when anything drifted or errored — drop it into CI.

## Design

The CLI is a thin transport: every command calls a function in `@planmap/core`
(via `@planmap/connectors` for analysis and `@planmap/db` for storage). No domain
logic lives here — the same engine answers identically from the CLI, the web app,
and (later) the VS Code extension.
