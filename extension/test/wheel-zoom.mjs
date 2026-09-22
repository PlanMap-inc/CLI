import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { clampScale, MIN_SCALE, wheelAction, zoomFactorFor } from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// --------------------------------------------------
// A wheel event carries how far the wheel turned. Reading only the sign and
// applying a flat step made one trackpad gesture - which is dozens of events
// - compound into a jump of about 17x. The factor must follow the distance.
// --------------------------------------------------

// Direction: away from the reader zooms out, towards them zooms in.
assert.ok(zoomFactorFor({ deltaY: 100 }) < 1, "scrolling down zooms out");
assert.ok(zoomFactorFor({ deltaY: -100 }) > 1, "scrolling up zooms in");
assert.equal(zoomFactorFor({ deltaY: 0 }), 1, "no travel, no zoom");
assert.equal(zoomFactorFor(), 1, "a missing event changes nothing");

// Proportional: a small nudge moves less than a big one.
const nudge = 1 - zoomFactorFor({ deltaY: 2 });
const shove = 1 - zoomFactorFor({ deltaY: 40 });
assert.ok(shove > nudge * 4, "a big turn must move more than a small one");

// Symmetric: in and out of the same distance must cancel, or repeated
// gestures would drift the scale in one direction.
const there = zoomFactorFor({ deltaY: 30 });
const back = zoomFactorFor({ deltaY: -30 });
assert.ok(Math.abs(there * back - 1) < 1e-9, "in and out must cancel exactly");

// Capped: no single event may lurch, however absurd the delta.
for (const deltaY of [500, 5000, 1e6, -5000, -1e6]) {
    const factor = zoomFactorFor({ deltaY });
    assert.ok(factor <= 1.08 + 1e-9 && factor >= 1 / 1.08 - 1e-9, `${deltaY} lurched: ${factor}`);
}

// The gesture as a whole stays controllable: a flick is dozens of events.
const flick = Array.from({ length: 30 }).reduce(total => total * zoomFactorFor({ deltaY: 10 }), 1);
assert.ok(flick > 0.4 && flick < 1, `a 30-event flick settled at ${flick}`);
assert.ok(Math.pow(1.1, 30) > 15, "which the old fixed step would have made a 17x jump");

// deltaMode is honoured: a mouse reporting 3 lines and one reporting ~48
// pixels are the same gesture and must zoom about the same.
const lines = zoomFactorFor({ deltaY: 3, deltaMode: 1 });
const pixels = zoomFactorFor({ deltaY: 48, deltaMode: 0 });
assert.ok(Math.abs(lines - pixels) < 0.02, `line mode ${lines} vs pixel mode ${pixels}`);

// A pinch arrives as ctrl+wheel and is a deliberate zoom, so it travels
// further per unit than an incidental scroll.
assert.ok(
    1 - zoomFactorFor({ deltaY: 6, ctrlKey: true }) > 1 - zoomFactorFor({ deltaY: 6 }),
    "a pinch must out-travel a plain scroll"
);

// The canvas uses it, rather than keeping a step of its own.
const main = fs.readFileSync(path.resolve(HERE, "../webview/main.js"), "utf8");
// --------------------------------------------------
// A PLAIN WHEEL PANS
// --------------------------------------------------
// It used to zoom, so reading down a long feature meant shrinking it. A
// wheel scrolls everywhere else on the machine; a pinch (which arrives as
// ctrl+wheel) and Ctrl/Cmd+wheel are the deliberate zoom.

assert.equal(wheelAction({ deltaY: 100 }).kind, "pan", "a plain wheel pans");
assert.equal(wheelAction({ deltaY: 100 }).dy, 100);
assert.equal(wheelAction({ deltaY: 100 }).dx, 0);
assert.equal(wheelAction({ deltaX: 40 }).dx, 40, "a trackpad's sideways delta pans sideways");

// Shift turns a vertical wheel sideways, which is what a mouse with one
// wheel has. A trackpad already sends deltaX and needs no help.
assert.deepEqual(
    { dx: wheelAction({ deltaY: 60, shiftKey: true }).dx, dy: wheelAction({ deltaY: 60, shiftKey: true }).dy },
    { dx: 60, dy: 0 }
);
assert.equal(wheelAction({ deltaX: 60, deltaY: 5, shiftKey: true }).dx, 60, "deltaX wins when the platform set it");

// Line and page deltas pan by the same unit the zoom uses.
assert.equal(wheelAction({ deltaY: 3, deltaMode: 1 }).dy, 48);

for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
    const action = wheelAction({ deltaY: 100, ...modifier });
    assert.equal(action.kind, "zoom", `${Object.keys(modifier)[0]} zooms`);
    assert.ok(action.factor < 1, "and down still zooms out");
}

// --------------------------------------------------
// THE FLOOR
// --------------------------------------------------
// Below 60% the titles stop being readable, and a map you cannot read is
// not a smaller map - it is a picture of one. Fitting used to land at 45%.

assert.equal(MIN_SCALE, 0.6);
assert.equal(clampScale(0.1), 0.6, "zoom never goes below the floor");
assert.equal(clampScale(0.6), 0.6);
assert.equal(clampScale(1.4), 1.4);
assert.equal(clampScale(99, 2.2), 2.2, "and never above the ceiling");

assert.match(main, /const action = wheelAction\(e\);/, "the wheel handler asks wheelAction");
assert.match(main, /if \(action\.kind === "zoom"\)/, "and zooms only when it says so");
assert.doesNotMatch(main, /zoomAround\([^)]*zoomFactorFor\(e\)\)/, "a plain wheel must not zoom");
assert.match(main, /clampScale\(scale \* factor, MAX_SCALE\)/, "and the zoom is clamped to the floor");
assert.doesNotMatch(main, /deltaY < 0 \? 1\.1 : 0\.9/, "the flat step must be gone");

console.log("PASS: wheel-zoom");
