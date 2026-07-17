# @planmap/ui

PlanMap's presentation layer: dependency-free React components that render a plain
**view-model** and emit callbacks. They never fetch and never import the engine, so the
same components serve the web app today and the VS Code webview later.

## What's in here

- **Design tokens** (`styles/tokens.css`) — a layered dark canvas with an
  information-coded accent set. Typography encodes provenance: JetBrains Mono is reserved
  for machine truth (paths, ranges, confidence), Inter for human/LLM narration. Fonts are
  provided by the host app, so the app stays offline; reduced-motion is respected.
- **View-model** (`model.ts`) — the seam. `PlanGraphView`, `ImpactView`, `EvoNode`, and the
  five-state status vocabulary. The host app maps engine types onto these shapes.
- **Components** — `PlanGraph` (React Flow), `AppShell` / `IconRail` / `Breadcrumb` /
  `LensSwitch`, `ImpactPanel`, `EvolutionTree` + `EvoNodeDetail`, and the `Status*` set.

## Using it

```tsx
import { AppShell, PlanGraph, ImpactPanel } from '@planmap/ui';
import '@planmap/ui/styles.css';
import '@xyflow/react/dist/style.css'; // PlanGraph renders with React Flow
```

The signature moment is **drift**: a drifted or errored node raises a callout that states
what diverged while keeping the original annotation (the _why_) intact beside it.
