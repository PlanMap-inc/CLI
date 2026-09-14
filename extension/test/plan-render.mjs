import assert from "node:assert/strict";

import { buildConstellation, buildFeatureGraph, NODE_H_EST } from "../webview/model.js";

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
assert.deepEqual(constellation.map(n => n.sub), ["4 nodes", "3 nodes", "0 nodes"]);
assert.deepEqual(constellation.map(n => n.title), ["Login", "Orders", "Ratings"]);

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
assert.ok(y.a1 > y.a2 && y.a2 > y.a3 && y.a3 > y.a4, "steps flow upward");
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

console.log("PASS: plan-render");
