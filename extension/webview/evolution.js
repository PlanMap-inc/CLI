// --------------------------------------------------
// PROJECT EVOLUTION MODEL
// --------------------------------------------------
// Pure functions over evolution.json: no DOM, no filesystem. Evolution is
// derived from code, so nothing here (or in evolution-view.js) changes it -
// it groups, nests and filters what the CLI wrote.
// --------------------------------------------------

import { LENS_PALETTE, colorAt } from "./model.js";

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

// Distinct tags in first-seen order; colours by index, never by name.
export function evolutionTags(evolution) {
    return [...new Set(evolutionNodes(evolution).flatMap(node => Array.isArray(node.tags) ? node.tags : []))];
}

export function tagColors(tags) {
    return Object.fromEntries(tags.map((tag, index) => [tag, colorAt(LENS_PALETTE, index)]));
}


// --------------------------------------------------
// TREE
// --------------------------------------------------
// Grouped by feature, then nested by parent: the CLI points a "changed" or
// "deleted" node at the "added" node for the same identity.
// --------------------------------------------------

const UNCLASSIFIED = "Unclassified";

function featureOf(node) {
    return node.feature || UNCLASSIFIED;
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

    const groups = new Map();

    for (const node of nodes) {
        const parent = resolveParent(node, byId);

        if (parent && featureOf(parent) === featureOf(node)) {
            items.get(parent).children.push(items.get(node));
            continue;
        }

        // Orphans - a missing or looping parent, or one filed under another
        // feature - sit at the top of their own feature group.
        const name = featureOf(node);

        if (!groups.has(name)) {
            groups.set(name, { id: `feature:${name}`, feature: true, title: name, status: null, tags: [], children: [] });
        }

        groups.get(name).children.push(items.get(node));
    }

    return [...groups.values()];
}

export function countNodes(tree) {
    return tree.reduce((sum, item) => sum + (item.feature ? 0 : 1) + countNodes(item.children), 0);
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

// Level 0 is the feature, 1 its declarations, 2 their changes. Branches
// deeper than level 2 start collapsed; a tag filter opens what it kept.
export function isCollapsed(item, depth, { filtered = false, toggled = new Map() } = {}) {
    if (item.children.length === 0) return false;
    if (toggled.has(item.id)) return toggled.get(item.id);
    return !filtered && depth >= 2;
}

export function describeDelta(delta) {
    if (!delta || typeof delta !== "object") return [];
    return Object.entries(delta).map(([key, value]) => ({
        key,
        value: typeof value === "string" ? value : JSON.stringify(value)
    }));
}
