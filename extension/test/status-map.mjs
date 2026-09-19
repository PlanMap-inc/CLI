import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { STATUSES, statusClass, statusDotStyle } from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.resolve(HERE, "../webview/styles.css"), "utf8");

assert.deepEqual(STATUSES, ["intended", "approved", "implemented", "drifted", "error", "superseded"]);

// Every status renders distinctly: its dot style and node class together differ from every other.
const renders = STATUSES.map(status => `${statusClass(status)} | ${statusDotStyle(status, "#7fe0b0")}`);
assert.equal(new Set(renders).size, 6, `statuses must render distinctly:\n${renders.join("\n")}`);

// Only drifted pulses.
for (const status of STATUSES) {
    assert.equal(statusClass(status).includes("pulse"), status === "drifted", `${status} pulse mismatch`);
}

// drifted and error share a red fill, but only drifted has the glow.
assert.match(statusDotStyle("drifted", "#fff"), /box-shadow/);
assert.doesNotMatch(statusDotStyle("error", "#fff"), /box-shadow/);

// implemented takes the feature/lens colour it is given.
assert.match(statusDotStyle("implemented", "#c89bff"), /#c89bff/);

// The stylesheet backs this up: superseded is historical, and the only canvas animation is the drift pulse.
assert.match(css, /\.gnode\.status-superseded\{opacity:\.4;\}/);
assert.match(css, /\.gnode\.pulse \.status-pill \.dot\{animation:driftPulse/);

const animatedSelectors = [...css.matchAll(/([^{}]+)\{[^}]*\banimation:[^}]*\}/g)]
    .map(match => match[1].trim())
    .filter(selector => !selector.startsWith("@media"));
assert.deepEqual(
    animatedSelectors.sort(),
    [".gnode.pulse .status-pill .dot", ".progress-bar.indeterminate span"].sort(),
    "on the canvas only a drifted node animates; the rest is chrome that reports work in progress"
);

// "Hand to agent" is gone: PlanMap explains and verifies, it does not hand
// work on. A permanently disabled button advertising a feature that does
// not exist costs more trust than the space it saves.
const html = fs.readFileSync(path.resolve(HERE, "../webview/index.html"), "utf8");
const main = fs.readFileSync(path.resolve(HERE, "../webview/main.js"), "utf8");
for (const gone of ["implementBtn", "implement-btn", "Hand to agent", "pulseReady"]) {
    assert.doesNotMatch(css + html + main, new RegExp(gone), `${gone} is still referenced`);
}
assert.deepEqual(
    animatedSelectors.filter(selector => selector.includes(".gnode")),
    [".gnode.pulse .status-pill .dot"],
    "no node on the canvas animates except a drifted one"
);

console.log("PASS: status-map");
