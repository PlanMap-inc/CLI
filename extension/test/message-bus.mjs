import assert from "node:assert/strict";

import { WEBVIEW_MESSAGE_TYPES, buildCliArgs, isWebviewMessage } from "../out/messages.js";

const root = "/work/project";
const identity = "src/auth.js::verifyToken:function";

// Every webview message and the one CLI invocation it must produce (brief Part 4).
const expected = {
    ready: [{ type: "ready" }, null],
    init: [{ type: "init" }, ["init", root]],
    verify: [{ type: "verify" }, ["verify", root, "--json"]],
    // approve and reject take the plan node id; the CLI matches id or identity.
    approve: [{ type: "approve", target: "plan_0001" }, ["approve", root, "plan_0001"]],
    approveLens: [{ type: "approveLens", lensId: "security" }, ["approve", root, "--lens", "security"]],
    reject: [{ type: "reject", target: "plan_0001", force: false }, ["reject", root, "plan_0001"]],
    // plan revise matches identity only.
    revise: [{ type: "revise", identity }, ["plan", "revise", root, identity]],
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
assert.equal(isWebviewMessage({ type: "revise", identity: "-x" }), false);

console.log("PASS: message-bus");
