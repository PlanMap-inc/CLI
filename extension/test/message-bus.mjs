import assert from "node:assert/strict";

import { WEBVIEW_MESSAGE_TYPES, buildCliArgs, isWebviewMessage, runsOffline } from "../out/messages.js";

const root = "/work/project";
const identity = "src/auth.js::verifyToken:function";

// Every webview message and the one CLI invocation it must produce (brief Part 4).
const expected = {
    ready: [{ type: "ready" }, null],
    init: [{ type: "init" }, ["init", root]],
    verify: [{ type: "verify" }, ["verify", root, "--json"]],
    approve: [{ type: "approve", identity }, ["approve", root, identity]],
    approveLens: [{ type: "approveLens", lensId: "security" }, ["approve", root, "--lens", "security"]],
    reject: [{ type: "reject", identity, force: false }, ["reject", root, identity]],
    revise: [{ type: "revise", identity }, ["plan", "revise", root, identity]],
    evolution: [{ type: "evolution" }, ["evolution", root]],
    draftPlan: [{ type: "draftPlan" }, ["plan", "draft", root]],
    // Handled by the host as an unsaved editor - no CLI call, no write.
    openPlan: [{ type: "openPlan" }, null]
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
    buildCliArgs({ type: "reject", identity, force: true }, root),
    ["reject", root, identity, "--force"],
    "rejecting an approved node adds --force"
);

// Scan's evolution run promises nothing leaves the machine; plan draft is the one AI action.
assert.equal(runsOffline({ type: "evolution" }), true);
assert.equal(runsOffline({ type: "draftPlan" }), false);
assert.equal(runsOffline({ type: "verify" }), false);

assert.equal(isWebviewMessage({ type: "writePlan" }), false, "unknown message types are rejected");
assert.equal(isWebviewMessage(null), false);

console.log("PASS: message-bus");
