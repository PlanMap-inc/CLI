// --------------------------------------------------
// PROJECT EVOLUTION MODEL
// --------------------------------------------------
// Pure functions over evolution.json: no DOM, no filesystem. Evolution is
// derived from code, so nothing here (or in evolution-view.js) changes it -
// it groups, nests and filters what the CLI wrote.
// --------------------------------------------------

import { LENS_IDS, LENS_PALETTE, colorAt } from "./model.js";

export const EVOLUTION_ICONS = {
    intended: "◌",
    approved: "○",
    implemented: "●",
    drifted: "⚠",
    error: "✕",
    superseded: "◐"
};

// The CLI also writes "deleted"; statuses outside the six get no icon, as in the demo.
export function evolutionIcon(status) {
    return Object.hasOwn(EVOLUTION_ICONS, status) ? EVOLUTION_ICONS[status] : "";
}

export function evolutionNodes(evolution) {
    return Array.isArray(evolution?.nodes) ? evolution.nodes.filter(node => node && typeof node === "object") : [];
}

// The tags present, in the shared lens order, so a lens is the same colour
// here as in the Plan Graph. Anything outside the vocabulary - an older
// graph, a hand-edited file - follows, in the order it was first seen.
export function evolutionTags(evolution) {
    const present = new Set(evolutionNodes(evolution).flatMap(node => Array.isArray(node.tags) ? node.tags : []));

    return [
        ...LENS_IDS.filter(id => present.has(id)),
        ...[...present].filter(tag => !LENS_IDS.includes(tag))
    ];
}

// A lens keeps the colour of its place in the vocabulary, whether or not
// this project uses every lens, so the same perspective reads the same in
// both views. A tag outside the vocabulary falls back to its own position.
export function tagColors(tags) {
    return Object.fromEntries(tags.map((tag, position) => {
        const index = LENS_IDS.indexOf(tag);
        return [tag, colorAt(LENS_PALETTE, index === -1 ? position : index)];
    }));
}


// --------------------------------------------------
// TREE
// --------------------------------------------------
// The shape is the project's, not a fixed schema. A declaration carries a
// path of however many grouping levels its part of the project needs:
//
//   feature        the capability                <- node.feature
//     path[0]      one job inside it             <- node.path
//       path[1]    a job inside that, if useful
//         ...      as deep as the code warrants
//           entry  a declaration                 <- node.label
//             change  what happened to it later  <- node.parent
//
// Nothing here caps the depth. What prunes it is a rule about information
// rather than a number: a level with a single child tells a reader nothing
// the child did not already say, so it is folded away. A graph written
// before paths existed, carrying one "group" string, reads exactly as it did.
// --------------------------------------------------

const UNCLASSIFIED = "Unclassified";

function featureOf(node) {
    return node.feature || UNCLASSIFIED;
}

// The grouping levels between a feature and this declaration. "group" is the
// single-level spelling PlanMap wrote first, and still reads.
function pathOf(node) {
    const raw = Array.isArray(node.path) ? node.path : [node.group];

    return raw
        .map(step => (typeof step === "string" ? step.trim() : ""))
        .filter(Boolean);
}

// The parent node, unless it is missing or its chain loops back.
function resolveParent(node, byId) {
    if (node.parent == null) return null;

    const parent = byId.get(node.parent);
    const seen = new Set([node.id]);

    for (let cursor = parent; cursor; cursor = byId.get(cursor.parent)) {
        if (seen.has(cursor.id)) return null;
        seen.add(cursor.id);
    }

    return parent ?? null;
}

// A level that does not branch adds a line without adding information, so
// its children move up in its place. Applied bottom-up, so a chain of
// single-child levels collapses the whole way.
function foldThrough(item) {
    item.children = item.children.map(child => (child.group || child.feature ? foldThrough(child) : child));

    if (item.group && item.children.length === 1) {
        return item.children[0];
    }

    return item;
}

export function buildEvolutionTree(evolution) {
    const nodes = evolutionNodes(evolution);
    const byId = new Map(nodes.map(node => [node.id, node]));

    const items = new Map(nodes.map(node => [node, {
        id: node.id,
        identity: node.identity ?? null,
        title: node.label || node.identity || String(node.id),
        status: node.status ?? null,
        tags: Array.isArray(node.tags) ? node.tags : [],
        source: node,
        children: []
    }]));

    const features = new Map();

    const featureItem = name => {
        if (!features.has(name)) {
            features.set(name, {
                id: `feature:${name}`, feature: true, title: name,
                status: null, tags: [], children: [], levels: new Map()
            });
        }
        return features.get(name);
    };

    // Walks the path, making each level it has not seen before. A level is
    // keyed by the whole path above it, so "Sign in > Tokens" under Login is
    // never confused with "Tokens" under Survey.
    const parentFor = node => {
        let here = featureItem(featureOf(node));
        let trail = here.title;

        for (const step of pathOf(node)) {
            trail += ` > ${step}`;

            if (!here.levels.has(step)) {
                const level = {
                    id: `group:${trail}`, group: true, title: step,
                    status: null, tags: [], children: [], levels: new Map()
                };
                here.levels.set(step, level);
                here.children.push(level);
            }

            here = here.levels.get(step);
        }

        return here;
    };

    for (const node of nodes) {
        const parent = resolveParent(node, byId);

        // A change nests under the declaration it changed.
        if (parent && featureOf(parent) === featureOf(node)) {
            items.get(parent).children.push(items.get(node));
            continue;
        }

        // Orphans - a missing or looping parent, or one filed under another
        // feature - sit at the top of the level their path names.
        parentFor(node).children.push(items.get(node));
    }

    const strip = item => {
        delete item.levels;
        item.children.forEach(child => { if (child.group || child.feature) strip(child); });
        return item;
    };

    return [...features.values()].map(feature => strip(foldThrough(feature)));
}

export function countNodes(tree) {
    return tree.reduce((sum, item) => sum + (item.feature || item.group ? 0 : 1) + countNodes(item.children), 0);
}

// Keeps matching items and every ancestor of a match, so the shape stays legible.
export function pruneByTag(tree, tag) {
    if (!tag) return tree;

    const prune = item => {
        const children = item.children.map(prune).filter(Boolean);
        return item.tags.includes(tag) || children.length ? { ...item, children } : null;
    };

    return tree.map(prune).filter(Boolean);
}

// Every grouping level opens, however deep, so the outline reads top to
// bottom. Only a declaration's own history starts collapsed, because that is
// the past rather than the shape. A tag filter opens what it kept.
export function isCollapsed(item, depth, { filtered = false, toggled = new Map() } = {}) {
    if (item.children.length === 0) return false;
    if (toggled.has(item.id)) return toggled.get(item.id);
    return !filtered && !item.feature && !item.group;
}

export function describeDelta(delta) {
    if (!delta || typeof delta !== "object") return [];
    return Object.entries(delta).map(([key, value]) => ({
        key,
        value: typeof value === "string" ? value : JSON.stringify(value)
    }));
}
