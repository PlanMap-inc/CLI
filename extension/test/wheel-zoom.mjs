import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { zoomFactorFor } from "../webview/model.js";

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
assert.match(main, /zoomAround\([^)]*zoomFactorFor\(e\)\)/, "the wheel handler must use it");
assert.doesNotMatch(main, /deltaY < 0 \? 1\.1 : 0\.9/, "the flat step must be gone");

console.log("PASS: wheel-zoom");
