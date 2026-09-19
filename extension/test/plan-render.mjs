import assert from "node:assert/strict";

import { buildConstellation, buildFeatureGraph, constellationEdges, NODE_H_EST } from "../webview/model.js";

const plan = {
    version: 1,
    lenses: [{ id: "business", label: "Business" }, { id: "backend", label: "Backend" }],
    features: [
        { id: "auth", name: "Login" },
        { id: "orders", name: "Orders" },
        { id: "empty", name: "Ratings" }
    ],
    nodes: [
        { id: "a1", title: "Enter email", intent: "x", feature: "auth", edgesOut: ["a2"] },
        { id: "a2", title: "Enter password", intent: "x", feature: "auth", edgesOut: ["a3"] },
        { id: "a3", title: "Hash check", intent: "x", feature: "auth", edgesOut: ["a4", "missing_node"] },
        { id: "a4", title: "JWT issued", intent: "x", feature: "auth", edgesOut: ["o1"] },
        { id: "o1", title: "Create order", intent: "x", feature: "orders", edgesOut: ["o2", "o3"] },
        { id: "o2", title: "Validate cart", intent: "x", feature: "orders", edgesOut: [] },
        { id: "o3", title: "Charge", intent: "x", feature: "orders", edgesOut: ["o1"] }
    ]
};

// Constellation: one node per feature, with the member count.
const constellation = buildConstellation(plan, {});
assert.equal(constellation.length, 3);
assert.deepEqual(constellation.map(n => n.sub), ["4 steps", "3 steps", "0 steps"]);
assert.deepEqual(constellation.map(n => n.step), [1, 2, 3], "features are numbered in the order they are met");
assert.deepEqual(constellation.map(n => n.title), ["Login", "Orders", "Ratings"]);

// Features stack bottom to top in plan order, in one column: the first
// thing a person does sits at the bottom, and the journey climbs.
const featureY = constellation.map(n => n.y);
assert.ok(featureY[0] > featureY[1] && featureY[1] > featureY[2], "the first feature sits at the bottom");
assert.equal(new Set(constellation.map(n => n.x)).size, 1);
for (let i = 1; i < featureY.length; i++) assert.ok(featureY[i - 1] - featureY[i] >= NODE_H_EST, "feature rows overlap");

// Connected by the plan's own links: a4 (auth) points at o1 (orders).
assert.deepEqual(constellationEdges(plan), [{ from: "auth", to: "orders", source: "nodes" }]);

// With no links across features, the plan's order connects them.
const unlinked = { features: [{ id: "a" }, { id: "b" }, { id: "c" }], nodes: [{ id: "n", feature: "a", edgesOut: [] }] };
assert.deepEqual(constellationEdges(unlinked), [
    { from: "a", to: "b", source: "order" },
    { from: "b", to: "c", source: "order" }
]);
assert.deepEqual(constellationEdges({ features: [{ id: "only" }], nodes: [] }), [], "one feature has nothing to connect to");
assert.deepEqual(constellationEdges(null), []);

// Feature Space: members only; dangling and cross-feature edges are dropped.
const auth = buildFeatureGraph(plan, "auth", {});
assert.equal(auth.nodes.length, 4);
assert.deepEqual(auth.edges, [
    { from: "a1", to: "a2" },
    { from: "a2", to: "a3" },
    { from: "a3", to: "a4" }
]);

// A chain lays out as one column, each step above the one it follows.
const y = Object.fromEntries(auth.nodes.map(n => [n.id, n.y]));
assert.ok(y.a1 > y.a2 && y.a2 > y.a3 && y.a3 > y.a4, "steps climb"),
assert.equal(new Set(auth.nodes.map(n => n.x)).size, 1);

// A cycle (o1 -> o3 -> o1) still produces a finite layout and keeps both edges.
const orders = buildFeatureGraph(plan, "orders", {});
assert.equal(orders.nodes.length, 3);
assert.equal(orders.edges.length, 3);
for (const n of orders.nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));

// Siblings on the same layer still get their own row: one vertical column, no overlap.
assert.equal(new Set(orders.nodes.map(n => n.x)).size, 1);
const ys = orders.nodes.map(n => n.y).sort((a, b) => a - b);
for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= NODE_H_EST, "rows overlap");

assert.deepEqual(buildFeatureGraph(plan, "empty", {}), { nodes: [], edges: [] });

// A feature whose nodes have no links of their own is connected in plan order.
const unlinkedFeature = {
    features: [{ id: "f", name: "F" }],
    nodes: [
        { id: "n1", title: "One", feature: "f", edgesOut: [] },
        { id: "n2", title: "Two", feature: "f" },
        { id: "n3", title: "Three", feature: "f", edgesOut: [] }
    ]
};
const chained = buildFeatureGraph(unlinkedFeature, "f", {});
assert.deepEqual(chained.edges, [
    { from: "n1", to: "n2", source: "order" },
    { from: "n2", to: "n3", source: "order" }
]);
assert.ok(chained.nodes[0].y > chained.nodes[2].y, "the first node sits at the bottom");
assert.equal(buildFeatureGraph({ features: [{ id: "f" }], nodes: [{ id: "only", feature: "f" }] }, "f", {}).edges.length, 0, "one node has nothing to connect to");

console.log("PASS: plan-render");
