// --------------------------------------------------
// PLAN GRAPH MODEL
// --------------------------------------------------
// Pure functions: no DOM, no filesystem. main.js renders what these
// return; the tests in extension/test/ import this file directly.
// Nothing here writes or invents data - it selects, orders and positions
// what plan.json and the verify-sourced statuses already contain.
// --------------------------------------------------

export const GRID = 24;
export const NODE_W = 172;
export const NODE_H_EST = 78;

// The demo's feature colours, in the demo's order. Assigned by index.
export const FEATURE_PALETTE = [
    "#6fa8ff", "#ff9f6f", "#7fe0b0", "#ffd873", "#c89bff", "#6fe0e0", "#ff7fb0"
];

// The demo's own dot colours, ordered to line up with the lens vocabulary
// below, so each perspective keeps the hue the demo gave that concept.
// Assigned by index; the rest are spare, for a lens a project adds itself.
export const LENS_PALETTE = [
    "#c89bff", "#6fa8ff", "#ff9f6f", "#5ec9c9", "#ff7fb0", "#ffd873", "#7fe0b0"
];

// The lens vocabulary, in the order src/llm/lenses.js defines it. The Plan
// Graph reads it from plan.json and Project Evolution from each node's tags,
// so both views must agree on the order to agree on the colours.
export const LENS_IDS = [
    "frontend", "backend", "database", "security"
];

// What each perspective asks of a step, from src/llm/lenses.js. A lens is a
// question you put to the whole journey, so the interface can say what the
// question was rather than showing a coloured word and leaving the reader
// to guess. A lens a project adds itself has no question, and shows none.
export const LENS_QUESTIONS = {
    frontend: "What does the person see and do?",
    backend: "What does the server do when the request arrives?",
    database: "What is read or written, and where?",
    security: "What decides whether this is allowed?"
};

export const STATUSES = [
    "intended", "approved", "implemented", "drifted", "error", "superseded"
];

// Worst first. A problem must never be hidden by aggregation.
const SEVERITY = ["drifted", "error", "intended", "approved", "implemented"];


export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function snap(value) {
    return Math.round(value / GRID) * GRID;
}

export function colorAt(palette, index) {
    return palette[((index % palette.length) + palette.length) % palette.length];
}


// --------------------------------------------------
// STATUS
// --------------------------------------------------

export function effectiveStatus(node, verifiedStatus) {
    const own = STATUSES.includes(node?.status) ? node.status : "intended";

    const verified = node?.identity ? verifiedStatus?.[node.identity] : null;

    // A verify result only speaks for the exact plan node version it checked.
    // After a revise the node has a new id, so an old drift no longer applies.
    if (
        verified &&
        STATUSES.includes(verified.status) &&
        verified.verifiedAgainst === `${node.id}@${node.version ?? 1}`
    ) {
        return verified.status;
    }

    return own;
}

export function featureStatus(nodes, verifiedStatus) {
    const statuses = nodes
        .map(node => effectiveStatus(node, verifiedStatus))
        .filter(status => status !== "superseded");

    if (statuses.length === 0) {
        return "intended";
    }

    return SEVERITY.find(status => statuses.includes(status)) ?? "intended";
}

export function statusClass(status) {
    const known = STATUSES.includes(status) ? status : "intended";
    return known === "drifted" ? "status-drifted pulse" : `status-${known}`;
}

export function statusDotStyle(status, color) {
    if (status === "intended") return "border:1.3px dashed var(--text-low)";
    if (status === "approved") return "border:1.3px solid var(--text-hi);background:transparent";
    if (status === "implemented") return `background:${color}`;
    if (status === "drifted") return "background:var(--danger);box-shadow:0 0 0 3px rgba(255,92,92,.18)";
    if (status === "error") return "background:var(--danger)";
    if (status === "superseded") return "border:1.3px solid var(--text-low);background:var(--text-low)";
    return "";
}


// --------------------------------------------------
// CONSTELLATION
// --------------------------------------------------

// Features stack bottom to top, in the order a person meets them, like the
// steps inside one: the first thing you do sits at the bottom and the
// journey climbs.
const CX = 300;
const CTOP_Y = 60;
const CSTEP_Y = 150;

export function nodesInFeature(plan, featureId) {
    return (plan?.nodes ?? []).filter(node => node.feature === featureId);
}

export function buildConstellation(plan, verifiedStatus) {
    const features = plan?.features ?? [];
    const order = (plan?.lenses ?? []).map(lens => lens.id);

    return features.map((feature, index) => {
        const members = nodesInFeature(plan, feature.id);
        const count = members.length;

        // Which perspectives this capability is built from, in lens order.
        // Three dots say "this one is interface and server, no data" at a
        // glance, which "7 steps" alone never could.
        const present = new Set(members.flatMap(node => node.lensTags ?? []));

        return {
            id: feature.id,
            step: index + 1,
            title: feature.name,
            sub: `${count} ${count === 1 ? "step" : "steps"}`,
            lenses: order.filter(id => present.has(id)),
            status: featureStatus(members, verifiedStatus),
            color: colorAt(FEATURE_PALETTE, index),
            x: snap(CX),
            y: snap(CTOP_Y + (features.length - 1 - index) * CSTEP_Y)
        };
    });
}

// What connects two features: a node in one with an edgesOut into another.
// A plan with no links across features falls back to the order it lists them in.
export function constellationEdges(plan) {
    const featureOf = new Map(
        (plan?.nodes ?? []).map(node => [node.id, node.feature])
    );

    const seen = new Set();
    const edges = [];

    for (const node of plan?.nodes ?? []) {
        for (const target of node.edgesOut ?? []) {
            const to = featureOf.get(target);
            const key = `${node.feature}->${to}`;

            if (!to || !node.feature || to === node.feature || seen.has(key)) continue;

            seen.add(key);
            edges.push({ from: node.feature, to, source: "nodes" });
        }
    }

    if (edges.length > 0) return edges;

    const ids = (plan?.features ?? []).map(feature => feature.id);

    return ids.slice(0, -1).map((id, index) => ({ from: id, to: ids[index + 1], source: "order" }));
}


// --------------------------------------------------
// FEATURE SPACE
// --------------------------------------------------
// Plan nodes carry no positions, so they are ordered by longest path over
// edgesOut and stacked one per row, bottom-to-top: step 1 at the bottom, and
// the feature climbs. A lens shows only the nodes tagged with it.
// --------------------------------------------------

const TOP_Y = 60;
const STEP_Y = 150;
const CENTER_X = 300;

export function nodeSub(node) {
    return node?.identity ? node.identity.split("::").pop() : "greenfield";
}

// A lens is a way of reading the journey, not a filter over it. Every step
// stays, in the same place, whichever lens is on: the feature keeps one
// shape, and switching perspective shows which parts of that one shape the
// perspective speaks to. Removing the others would leave a different
// journey each time, and a reader could not tell what was being left out.
export function buildFeatureGraph(plan, featureId, verifiedStatus, lensId = null) {
    const members = nodesInFeature(plan, featureId);
    const ids = new Set(members.map(node => node.id));

    const edges = [];

    for (const node of members) {
        for (const target of node.edgesOut ?? []) {
            if (ids.has(target) && target !== node.id) {
                edges.push({ from: node.id, to: target });
            }
        }
    }

    const layer = layerByLongestPath(members, edges);

    // Stable sort keeps plan order within a layer.
    // ponytail: one column, so an edge that skips a row is drawn behind the
    // node between; route around it if plans with branches make that confusing.
    const ordered = [...members].sort((a, b) => layer.get(a.id) - layer.get(b.id));

    // A perspective renames the step in its own words. Same step, same
    // place, same rules - only the wording changes, which is the whole
    // point: a reader who thinks in one of these terms reads the journey in
    // that language. A step the lens has no reading for keeps its own title.
    const reading = node => (lensId && node.readings?.[lensId]) || node.title;

    const nodes = ordered.map((node, row) => ({
        id: node.id,
        step: row + 1,
        title: reading(node),
        // What it is called when no lens is on, so the panel can show both.
        plainTitle: node.title,
        sub: nodeSub(node),
        status: effectiveStatus(node, verifiedStatus),
        lensTags: node.lensTags ?? [],
        // Whether this perspective had its own words for the step. Not a
        // reason to hide it: every step stands in every lens, and one
        // without a reading simply keeps the name it already had.
        renamed: Boolean(lensId && node.readings?.[lensId]),
        x: snap(CENTER_X),
        y: snap(TOP_Y + (ordered.length - 1 - row) * STEP_Y),
        source: node
    }));

    // A feature whose nodes carry no links of their own is connected in plan
    // order: the order they are drawn in, bottom to top.
    const shown = edges.length > 0
        ? edges
        : ordered.slice(0, -1).map((node, row) => ({ from: node.id, to: ordered[row + 1].id, source: "order" }));

    return { nodes, edges: shown };
}

function layerByLongestPath(members, edges) {
    const outgoing = new Map(members.map(node => [node.id, []]));
    for (const edge of edges) outgoing.get(edge.from).push(edge.to);

    // Depth-first order, skipping back edges, gives a topological order of
    // the graph with cycles broken - each node is visited exactly once.
    const state = new Map();
    const order = [];
    const backEdges = new Set();

    const visit = id => {
        state.set(id, "open");
        for (const next of outgoing.get(id)) {
            if (state.get(next) === "open") {
                backEdges.add(`${id}->${next}`);
            } else if (!state.has(next)) {
                visit(next);
            }
        }
        state.set(id, "done");
        order.push(id);
    };

    for (const node of members) {
        if (!state.has(node.id)) visit(node.id);
    }

    order.reverse();

    const layer = new Map(members.map(node => [node.id, 0]));

    for (const id of order) {
        for (const next of outgoing.get(id)) {
            if (backEdges.has(`${id}->${next}`)) continue;
            layer.set(next, Math.max(layer.get(next), layer.get(id) + 1));
        }
    }

    return layer;
}


// --------------------------------------------------
// LENSES
// --------------------------------------------------

// A lens keeps its colour from its position in the vocabulary, so the same
// perspective is the same colour here and in Project Evolution. A lens a
// project defined for itself takes a colour after the vocabulary's.
export function lensColors(plan) {
    const lenses = plan?.lenses ?? [];
    const colors = {};

    lenses.forEach((lens, position) => {
        const index = LENS_IDS.indexOf(lens.id);
        colors[lens.id] = colorAt(LENS_PALETTE, index === -1 ? position : index);
    });

    return colors;
}

// How much each perspective has to say about this feature: the number of
// steps it has its own words for. Every step is shown under every lens, so
// this is not how many you will see - it is how much of the feature this
// perspective re-describes, and a zero says the feature has nothing to tell
// you from there.
export function lensCoverage(plan, featureId) {
    const members = nodesInFeature(plan, featureId);

    // A step belongs to a perspective when the scan tagged it with that lens,
    // whether or not the draft found separate words for it. Counting only the
    // readings made the number swing between runs on identical code, which
    // made the lens itself look unreliable.
    return (plan?.lenses ?? []).map(lens => {
        const count = members.filter(node =>
            node.readings?.[lens.id] || (node.lensTags ?? []).includes(lens.id)
        ).length;

        return {
            id: lens.id,
            label: lens.label ?? lens.id,
            count,
            empty: count === 0
        };
    });
}


// --------------------------------------------------
// NODE DETAIL
// --------------------------------------------------

export function describeClause(field, clause) {
    if (!clause || typeof clause !== "object") return `${field}`;
    const value = clause.value === undefined ? "" : ` ${JSON.stringify(clause.value)}`;
    return `${field} ${clause.op}${value}`;
}

export function describeRules(rules) {
    return (rules ?? []).map(rule => ({
        kind: rule.kind,
        target: rule.target,
        clauses: Object.entries(rule.assert ?? {}).map(([field, clause]) =>
            rule.kind === "structure"
                ? `${field} ${Array.isArray(clause) ? clause.join(", ") : clause}`
                : describeClause(field, clause)
        )
    }));
}

export function describeHistory(history) {
    return (history ?? []).map(entry => ({
        version: `v${entry.version ?? 1}`,
        intent: entry.intent ?? "",
        status: entry.status ? `was ${entry.status}` : ""
    }));
}


// --------------------------------------------------
// DRIFT SYNC, NAV RAIL, ONBOARDING
// --------------------------------------------------
// One verify run writes its statuses into evolution.json. The Plan Graph
// (effectiveStatus), the Evolution view (node.status) and the rail badge all
// read those statuses, joined on the exact identity string.
// --------------------------------------------------

export function driftCount(verifiedStatus) {
    return Object.values(verifiedStatus ?? {}).filter(entry => entry?.status === "drifted").length;
}

export const VIEWS = [
    { id: "planmap", label: "Plan Graph" },
    { id: "evolution", label: "Project Evolution" }
];

export function railModel(activeView, verifiedStatus) {
    const active = VIEWS.some(view => view.id === activeView) ? activeView : "planmap";
    const count = driftCount(verifiedStatus);

    return {
        active,
        buttons: VIEWS.map(view => ({ ...view, active: view.id === active })),
        badge: count > 0 ? { count, label: `${count} drifted` } : null
    };
}

// A: no .planmap/.  B: scanned, no plan.json.  C: a plan nothing has verified yet.
export function onboardingState(state) {
    if (!state) return null;
    if (state.setup === "missing") return { kind: "scan" };
    if (state.setup === "no-plan") return { kind: "no-plan", declarations: state.declarationCount ?? null };
    if (state.setup === "invalid-plan") return { kind: "invalid-plan", problem: state.problem };
    if (Object.keys(state.verifiedStatus ?? {}).length === 0) return { kind: "verify" };
    return null;
}


// --------------------------------------------------
// PLAN DECISIONS AND VERIFY DETAIL
// --------------------------------------------------

// Mirrors src/plan/approval.js. Approve takes intended nodes. Reject removes an
// intended node, or an approved one with --force. Revise reopens an approved
// node as a new intended version, and "plan revise" matches on identity only.
export function nodeActions(node) {
    const status = node?.status;
    const target = typeof node?.id === "string" ? node.id : null;
    const identity = typeof node?.identity === "string" && node.identity ? node.identity : null;

    const reviseReason =
        status === "intended" ? "Already intended: edit it in plan.json, then approve it"
            : status !== "approved" ? "Only approved nodes can be revised"
                : "The CLI revises by identity, and this node has no code yet";

    return [
        {
            type: "approve",
            label: "Approve",
            enabled: status === "intended" && Boolean(target),
            hint: "Lock in this intent; Verify checks the code against it",
            reason: status === "approved" ? "Already approved" : "Only intended nodes can be approved",
            message: { type: "approve", target }
        },
        {
            type: "revise",
            label: "Revise",
            enabled: status === "approved" && Boolean(identity),
            hint: "Reopen as a new intended version; this version moves to history",
            reason: reviseReason,
            message: { type: "revise", identity }
        },
        {
            type: "reject",
            label: "Reject",
            tone: "danger",
            enabled: (status === "intended" || status === "approved") && Boolean(target),
            hint: "Remove this node from the plan",
            reason: "Only intended or approved nodes can be rejected",
            message: { type: "reject", target, force: status === "approved" }
        }
    ];
}

// The verify --json result for this exact plan node version, if the last run checked it.
export function verifyResultFor(verify, node) {
    const results = Array.isArray(verify?.results) ? verify.results : [];
    return results.find(result =>
        result?.planNodeId === node?.id &&
        (result.planVersion ?? 1) === (node?.version ?? 1)
    ) ?? null;
}

function showValue(value) {
    if (value === undefined) return "—";
    return typeof value === "string" ? value : JSON.stringify(value);
}

export function describeViolation(violation) {
    return {
        field: violation?.field ?? violation?.target ?? "rule",
        expected: showValue(violation?.expected),
        actual: showValue(violation?.actual),
        reason: violation?.reason ?? violation?.message ?? ""
    };
}

export function describeImpact(entry) {
    return {
        identity: entry?.identity ?? entry?.target ?? "unknown",
        meta: [
            entry?.kind ?? null,
            Number.isFinite(entry?.depth) ? `depth ${entry.depth}` : null,
            entry?.confidence != null ? `${entry.confidence} confidence` : null
        ].filter(Boolean).join(" · ")
    };
}


// --------------------------------------------------
// SCAN PROGRESS
// --------------------------------------------------
// Reads the CLI's own output as it runs. Nothing here invents a step: every
// number comes from a line the CLI printed.
// --------------------------------------------------

const DECLARATIONS = /^Found (\d+) declarations/;
const BATCH_TOTAL = /^Evolution classification: (\d+) events in (\d+) batch\(es\)/;
const BATCH_START = /^Classifying label batch (\d+)\/(\d+)/;
const BATCH_DONE = /^Label batch (\d+) persisted successfully/;
const BATCH_FAILED = /^Label batch (\d+) failed/;

export function parseScanProgress(lines) {
    let total = null;
    let done = 0;
    let failed = 0;
    let declarations = null;
    let finished = false;
    let label = "Starting…";
    let match;

    for (const raw of lines ?? []) {
        const line = String(raw).trim();

        if ((match = DECLARATIONS.exec(line))) {
            declarations = Number(match[1]);
            label = `${declarations} ${declarations === 1 ? "declaration" : "declarations"} found`;
        } else if (/^Baseline written/.test(line)) {
            label = "Reading what the code does now";
        } else if ((match = BATCH_TOTAL.exec(line))) {
            total = Number(match[2]);
            label = `${match[1]} to classify, in ${total} ${total === 1 ? "batch" : "batches"}`;
        } else if ((match = BATCH_START.exec(line))) {
            total = Number(match[2]);
            label = `Classifying batch ${match[1]} of ${match[2]}`;
        } else if ((match = BATCH_DONE.exec(line))) {
            done = Math.max(done, Number(match[1]));
            label = `Batch ${match[1]} classified`;
        } else if ((match = BATCH_FAILED.exec(line))) {
            failed += 1;
            done = Math.max(done, Number(match[1]));
            label = `Batch ${match[1]} kept path labels`;
        } else if (/^Evolution written/.test(line)) {
            finished = true;
            label = failed > 0 ? `Done, ${failed} ${failed === 1 ? "batch" : "batches"} without AI` : "Done";
        } else if (/^Plan drafted/.test(line)) {
            finished = true;
            label = "Plan drafted";
        } else if (/^OPENROUTER_API_KEY not configured/.test(line)) {
            label = "No API key: labelling from file paths";
        }
    }

    return {
        percent: finished ? 100 : total ? Math.round((done / total) * 100) : null,
        label,
        total,
        done,
        failed,
        declarations,
        finished
    };
}
