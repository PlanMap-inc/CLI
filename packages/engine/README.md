# @planmap/engine

The orchestration facade over [`@planmap/core`](../core) (pure engine),
[`@planmap/connectors`](../connectors) (analysis), and [`@planmap/db`](../db) (storage).
This is the single brain every surface calls, so the CLI, the web app, and the later VS
Code extension cannot give different answers.

## The operations

| Function                                 | What it does                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `initStore(root)`                        | Create a `.planmap` store (idempotent).                                     |
| `mapRepo(repo, store?, now?)`            | Analyze a repo and auto-populate the Evolution graph.                       |
| `loadGraph(store)`                       | Read the stored nodes + edges (the read counterpart to `mapRepo`).          |
| `impactForNode(id, repo, store?, llm?)`  | What a change affects — parser decides _what_, the LLM only narrates _why_. |
| `approveNode(id, store, now?)`           | Approve a node, setting the baseline drift is measured against.             |
| `driftCheck(repo, store?, llm?, now?)`   | Re-verify approved nodes against the real code.                             |
| `handoffForNode(id, repo, store?, llm?)` | Compose a scoped instruction for the developer's own coding agent.          |
| `projectMarkdown(store)`                 | Regenerate the markdown projection (the dual-view).                         |

`resolveLlmProvider()` returns the optional BYO-key provider; in M1 it is `undefined`, so
the full, correct _what_ is produced and only the plain-language _why_ is absent — never
guessed. The LLM is never metered.
