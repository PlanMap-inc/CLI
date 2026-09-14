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

// The demo's lens colours (business, backend, security, database, frontend),
// extended to seven from the feature palette. Assigned by index.
export const LENS_PALETTE = [
    "#7fe0b0", "#6fa8ff", "#ff9f6f", "#5ec9c9", "#c89bff", "#ffd873", "#ff7fb0"
];

export const STATUSES = [
    "intended", "approved", "implemented", "drifted", "error", "superseded"
];

// Worst first. A problem must never be hidden by aggregation.
const SEVERITY = ["drifted", "error", "intended", "approved", "implemented"];


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

const CX = 200;
const CY = 420;
const CSTEP = 236;

export function nodesInFeature(plan, featureId) {
    return (plan?.nodes ?? []).filter(node => node.feature === featureId);
}

export function buildConstellation(plan, verifiedStatus) {
    return (plan?.features ?? []).map((feature, index) => {
        const members = nodesInFeature(plan, feature.id);
        const count = members.length;

        return {
            id: feature.id,
            title: feature.name,
            sub: `${count} ${count === 1 ? "node" : "nodes"}`,
            status: featureStatus(members, verifiedStatus),
            color: colorAt(FEATURE_PALETTE, index),
            x: snap(CX + CSTEP * index),
            y: snap(CY)
        };
    });
}


// --------------------------------------------------
// FEATURE SPACE
// --------------------------------------------------
// Plan nodes carry no positions, so they are ordered by longest path over
// edgesOut and stacked one per row, bottom-to-top, matching the demo's
// "step order". A lens shows only the nodes tagged with it.
// --------------------------------------------------

const TOP_Y = 60;
const STEP_Y = 150;
const CENTER_X = 300;

export function nodeSub(node) {
    return node?.identity ? node.identity.split("::").pop() : "greenfield";
}

export function buildFeatureGraph(plan, featureId, verifiedStatus, lensId = null) {
    const members = nodesInFeature(plan, featureId)
        .filter(node => !lensId || (node.lensTags ?? []).includes(lensId));
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

    const nodes = ordered.map((node, row) => ({
        id: node.id,
        title: node.title,
        sub: nodeSub(node),
        status: effectiveStatus(node, verifiedStatus),
        lensTags: node.lensTags ?? [],
        x: snap(CENTER_X),
        y: snap(TOP_Y + (ordered.length - 1 - row) * STEP_Y),
        source: node
    }));

    return { nodes, edges };
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

export function lensColors(plan) {
    const colors = {};
    (plan?.lenses ?? []).forEach((lens, index) => {
        colors[lens.id] = colorAt(LENS_PALETTE, index);
    });
    return colors;
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
