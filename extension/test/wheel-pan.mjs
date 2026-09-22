import assert from "node:assert/strict";
import fs from "node:fs";

import { clampScale, MIN_SCALE, wheelAction, zoomFactorFor } from "../webview/model.js";

const main = fs.readFileSync(new URL("../webview/main.js", import.meta.url), "utf8");

// --------------------------------------------------
// A WHEEL SCROLLS
// --------------------------------------------------
// It used to zoom, so reading down a long feature meant shrinking it, and
// there was no way to scroll a map that is deliberately taller than the
// canvas. A wheel scrolls everywhere else on the machine.
//
// Pinch arrives as ctrl+wheel, and Ctrl/Cmd+wheel is the deliberate zoom -
// so zooming is something you ask for.
// --------------------------------------------------

const plain = wheelAction({ deltaY: 120 });

assert.equal(plain.kind, "pan");
assert.equal(plain.dy, 120);
assert.equal(plain.dx, 0);

assert.equal(wheelAction({ deltaY: -60 }).dy, -60, "and up pans the other way");
assert.equal(wheelAction({ deltaX: 45 }).dx, 45, "a trackpad's sideways delta pans sideways");
assert.equal(wheelAction({ deltaX: 45, deltaY: 12 }).dy, 12, "both axes at once, as a trackpad sends them");


// --------------------------------------------------
// SHIFT TURNS A ONE-WHEEL MOUSE SIDEWAYS
// --------------------------------------------------
// A trackpad already sends deltaX and needs no help, so a platform that
// set it wins.

assert.deepEqual(
    (({ dx, dy }) => ({ dx, dy }))(wheelAction({ deltaY: 80, shiftKey: true })),
    { dx: 80, dy: 0 }
);

assert.equal(wheelAction({ deltaX: 80, deltaY: 5, shiftKey: true }).dx, 80);
assert.equal(wheelAction({ deltaX: 80, deltaY: 5, shiftKey: true }).dy, 5);


// --------------------------------------------------
// CTRL AND CMD ZOOM
// --------------------------------------------------

for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
    const key = Object.keys(modifier)[0];
    const action = wheelAction({ deltaY: 100, ...modifier });

    assert.equal(action.kind, "zoom", `${key} zooms`);
    assert.ok(action.factor < 1, `${key} and down still zooms out`);
    assert.equal(action.factor, zoomFactorFor({ deltaY: 100, ...modifier }), "using the existing curve");
}

assert.ok(wheelAction({ deltaY: -100, ctrlKey: true }).factor > 1, "up zooms in");


// --------------------------------------------------
// LINE AND PAGE DELTAS
// --------------------------------------------------
// A wheel that reports lines pans by the same unit the zoom reads them at.

assert.equal(wheelAction({ deltaY: 3, deltaMode: 1 }).dy, 48);
assert.equal(wheelAction({ deltaY: 1, deltaMode: 2 }).dy, 400);
assert.equal(wheelAction({ deltaY: 0 }).dy, 0);
assert.equal(wheelAction().kind, "pan", "a missing event pans by nothing");
assert.equal(wheelAction().dy, 0);


// --------------------------------------------------
// THE FLOOR
// --------------------------------------------------
// Below 60% the titles stop being readable, and a map you cannot read is
// not a smaller map - it is a picture of one. Fitting used to land at 45%.

assert.equal(MIN_SCALE, 0.6);
assert.equal(clampScale(0.01), 0.6);
assert.equal(clampScale(0.599), 0.6);
assert.equal(clampScale(0.6), 0.6);
assert.equal(clampScale(1), 1);
assert.equal(clampScale(5, 2.2), 2.2, "and a ceiling at the other end");

// However many times you scroll out, it stops there.
let scale = 1;
for (let at = 0; at < 200; at += 1) scale = clampScale(scale * wheelAction({ deltaY: 40, ctrlKey: true }).factor);
assert.equal(scale, MIN_SCALE);


// --------------------------------------------------
// WHAT THE VIEW DOES WITH IT
// --------------------------------------------------

assert.match(main, /const action = wheelAction\(e\);/, "the handler asks wheelAction");
assert.match(main, /if \(action\.kind === "zoom"\)/);
assert.match(main, /panX -= action\.dx;/, "and pans by what it returns");
assert.match(main, /panY -= action\.dy;/);
assert.match(main, /clampScale\(scale \* factor, MAX_SCALE\)/, "the zoom is clamped to the floor");
assert.doesNotMatch(main, /const MIN_SCALE = 0\.3;/, "the old floor is gone");

console.log("PASS: wheel-pan");
