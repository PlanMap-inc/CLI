import assert from "node:assert/strict";

import { WEBVIEW_MESSAGE_TYPES, buildCliArgs, buildCliSteps, isWebviewMessage, readScanSummary } from "../out/messages.js";

const root = "/work/project";
const identity = "src/auth.js::verifyToken:function";

// Every webview message and the one CLI invocation it must produce (brief Part 4).
const expected = {
    ready: [{ type: "ready" }, null],
    init: [{ type: "init" }, ["init", root]],
    verify: [{ type: "verify" }, ["verify", root, "--json"]],
    // approve and reject take the plan node id; the CLI matches id or identity.
    approve: [{ type: "approve", target: "plan_0001" }, ["approve", root, "plan_0001"]],
    // The toolbar's one approve button on the Constellation: the whole plan.
    approveAll: [{ type: "approveAll" }, ["approve", root, "--all"]],
    // "Approve Survey" from inside a feature.
    approveFeature: [{ type: "approveFeature", featureId: "feat_0003" }, ["approve", root, "--feature", "feat_0003"]],
    // "Approve Security" from inside a feature is scoped to that feature.
    // Without the featureId - which is how the Constellation would send it -
    // it stays the plan-wide call it has always been.
    approveLens: [
        { type: "approveLens", lensId: "security", featureId: "feat_0003" },
        ["approve", root, "--feature", "feat_0003", "--lens", "security"]
    ],
    reject: [{ type: "reject", target: "plan_0001", force: false }, ["reject", root, "plan_0001"]],
    // plan revise matches identity only.
    revise: [{ type: "revise", identity }, ["plan", "revise", root, identity]],
    // Authoring on the canvas: one CLI command each, so a step added or moved
    // there is identical to one added or moved from a terminal.
    addNode: [{ type: "addNode", feature: "feat_0001", title: "A step" }, ["plan", "add", root, "--feature", "feat_0001", "--title", "A step"]],
    renameNode: [{ type: "renameNode", target: "plan_0001", title: "A better name" }, ["plan", "rename", root, "plan_0001", "--title", "A better name"]],
    // A feature's name on the Constellation is a model's reading of the code,
    // so a person can correct it - through the CLI like everything else.
    renameFeature: [{ type: "renameFeature", target: "feat_0001", name: "Sign in" }, ["plan", "rename-feature", root, "feat_0001", "--name", "Sign in"]],
    moveNode: [{ type: "moveNode", target: "plan_0001", x: 240, y: 96 }, ["plan", "move", root, "plan_0001", "--x", "240", "--y", "96"]],
    reorderNode: [{ type: "reorderNode", target: "plan_0001", after: "plan_0002" }, ["plan", "order", root, "plan_0001", "--after", "plan_0002"]],
    evolution: [{ type: "evolution" }, ["evolution", root]],
    draftPlan: [{ type: "draftPlan" }, ["plan", "draft", root]],
    // Handled by the host as an unsaved editor - no CLI call, no write.
    openPlan: [{ type: "openPlan" }, null],
    // Handled by the host: VS Code's folder picker, then the window reopens there.
    openFolder: [{ type: "openFolder" }, null],
    // Handled by the host with VS Code's secret storage - no CLI call.
    setApiKey: [{ type: "setApiKey" }, null]
};

assert.deepEqual(
    [...WEBVIEW_MESSAGE_TYPES].sort(),
    Object.keys(expected).sort(),
    "every declared message type must have an expected CLI mapping in this test"
);

for (const type of WEBVIEW_MESSAGE_TYPES) {
    const [message, argv] = expected[type];
    assert.equal(isWebviewMessage(message), true, `${type} must be accepted`);
    assert.deepEqual(buildCliArgs(message, root), argv, `${type} maps to the wrong CLI invocation`);
}

assert.deepEqual(
    buildCliArgs({ type: "reject", target: "plan_0001", force: true }, root),
    ["reject", root, "plan_0001", "--force"],
    "rejecting an approved node adds --force"
);

assert.equal(isWebviewMessage({ type: "writePlan" }), false, "unknown message types are rejected");
assert.equal(isWebviewMessage(null), false);

// Values that become CLI arguments must be real values, never flags.
assert.equal(isWebviewMessage({ type: "approve" }), false, "a missing target is rejected");
assert.equal(isWebviewMessage({ type: "approve", target: "" }), false);
assert.equal(isWebviewMessage({ type: "approve", target: 42 }), false);
assert.equal(isWebviewMessage({ type: "approve", target: "--all" }), false, "a flag can't be smuggled in as a target");
assert.equal(isWebviewMessage({ type: "approveLens", lensId: "--feature" }), false);

// A lens with no feature is still the plan-wide call.
assert.deepEqual(
    buildCliArgs({ type: "approveLens", lensId: "security" }, root),
    ["approve", root, "--lens", "security"]
);
assert.equal(isWebviewMessage({ type: "revise", identity: "-x" }), false);

// --------------------------------------------------
// REFRESH EVOLUTION IS TWO COMMANDS
// --------------------------------------------------
// "evolution" only turns recorded events into the outline; "check" is what
// reads the code and records them. Running the second alone rebuilds the
// same graph however much the code has moved on - which is exactly what it
// did, and why a refresh appeared to do nothing.

assert.deepEqual(
    buildCliSteps({ type: "evolution" }, root),
    [["check", root, "--json"], ["evolution", root]],
    "a refresh must read the code before it rebuilds the outline, and report what it found"
);

// The summary the view reports comes straight from the CLI's own counts.
assert.deepEqual(
    readScanSummary({ summary: { changes: 3, significant: 3, added: 1, deleted: 1 } }),
    { changes: 3, added: 1, deleted: 1, significant: 3, changed: 1 },
    "changed is what is left once new and removed are taken out"
);
assert.deepEqual(
    readScanSummary({ summary: { changes: 0, significant: 0, added: 0, deleted: 0 } }),
    { changes: 0, added: 0, deleted: 0, significant: 0, changed: 0 },
    "a scan that found nothing is a result, not a missing one"
);
assert.equal(readScanSummary(null), null);
assert.equal(readScanSummary({}), null, "output without a summary reports nothing rather than zeroes");

// Everything else stays one command, and matches buildCliArgs exactly.
for (const [type, [message, args]] of Object.entries(expected)) {
    if (type === "evolution") continue;
    assert.deepEqual(
        buildCliSteps(message, root),
        args ? [args] : [],
        `${type} is a single step`
    );
}

// A title is someone's own words, so it may start with anything - it travels
// as the value of --title and can never be read as a flag.
assert.equal(isWebviewMessage({ type: "renameNode", target: "plan_0001", title: "--all" }), true);
assert.equal(isWebviewMessage({ type: "renameNode", target: "plan_0001", title: "   " }), false, "a blank title is not a name");
assert.equal(isWebviewMessage({ type: "addNode", feature: "f", title: "x".repeat(201) }), false, "a title has a ceiling");

// A feature name is held to the same standard as a step title.
assert.equal(isWebviewMessage({ type: "renameFeature", target: "feat_0001", name: "--lens" }), true);
assert.equal(isWebviewMessage({ type: "renameFeature", target: "feat_0001", name: " " }), false, "a blank name is not a name");
assert.equal(isWebviewMessage({ type: "renameFeature", target: "feat_0001" }), false, "a rename needs a name");

// A position is two finite numbers and nothing else.
assert.equal(isWebviewMessage({ type: "moveNode", target: "p", x: 1, y: 2 }), true);
assert.equal(isWebviewMessage({ type: "moveNode", target: "p", x: "1", y: 2 }), false);
assert.equal(isWebviewMessage({ type: "moveNode", target: "p", x: NaN, y: 2 }), false);

// "after: null" means first, which is a real instruction rather than a gap.
assert.deepEqual(
    buildCliArgs({ type: "reorderNode", target: "plan_0001", after: null }, root),
    ["plan", "order", root, "plan_0001", "--first"]
);

console.log("PASS: message-bus");
