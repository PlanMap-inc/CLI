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
// Four levels, so a feature with a dozen declarations reads as a few jobs
// rather than a flat list:
//
//   feature      the capability            <- node.feature
//     group      one job inside it         <- node.group
//       entry    a declaration             <- node.label
//         change what happened to it later <- node.parent
//
// The group level is skipped for a declaration the scan gave no group, and
// for a feature where no declaration has one, so a graph written before
// groups existed reads exactly as it did.
// --------------------------------------------------

const UNCLASSIFIED = "Unclassified";

function featureOf(node) {
    return node.feature || UNCLASSIFIED;
}

function groupOf(node) {
    return typeof node.group === "string" && node.group.trim() ? node.group.trim() : null;
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

    const features = new Map();

    const featureItem = name => {
        if (!features.has(name)) {
            features.set(name, {
                id: `feature:${name}`, feature: true, title: name,
                status: null, tags: [], children: [], groups: new Map()
            });
        }
        return features.get(name);
    };

    // Where a declaration hangs: its feature, or a group inside it.
    const parentFor = node => {
        const feature = featureItem(featureOf(node));
        const group = groupOf(node);

        if (!group) return feature;

        if (!feature.groups.has(group)) {
            const item = {
                id: `group:${feature.title}:${group}`, group: true, title: group,
                status: null, tags: [], children: []
            };
            feature.groups.set(group, item);
            feature.children.push(item);
        }

        return feature.groups.get(group);
    };

    for (const node of nodes) {
        const parent = resolveParent(node, byId);

        // A change nests under the declaration it changed.
        if (parent && featureOf(parent) === featureOf(node)) {
            items.get(parent).children.push(items.get(node));
            continue;
        }

        // Orphans - a missing or looping parent, or one filed under another
        // feature - sit at the top of their own feature or group.
        parentFor(node).children.push(items.get(node));
    }

    // A lone group adds a level without telling the reader anything.
    for (const feature of features.values()) {
        if (feature.children.length === 1 && feature.children[0].group) {
            feature.children = feature.children[0].children;
        }
        delete feature.groups;
    }

    return [...features.values()];
}

// Declarations and their changes. Features and groups are headings, not entries.
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

// Features and groups open, so the outline reads top to bottom. A
// declaration's own history starts collapsed; a tag filter opens what it kept.
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
