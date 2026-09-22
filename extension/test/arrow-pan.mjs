import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { panAxis, panDirection, panVelocity, PAN_DIRECTIONS, PAN_SPEED, PAN_FAST, PAN_TAU } from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const main = fs.readFileSync(path.resolve(HERE, "../webview/main.js"), "utf8");

// --------------------------------------------------
// WALKING THE MAP WITH THE ARROW KEYS
// --------------------------------------------------
// The first version moved the map a fixed distance per key press and let the
// operating system's key repeat supply the rest. That repeat waits, then
// fires at its own rate, so a held key lurched, paused, and stuttered.
// --------------------------------------------------

// Up reveals what is above, which means moving the content DOWN.
assert.deepEqual(panDirection(["ArrowUp"]), { x: 0, y: 1 });
assert.deepEqual(panDirection(["ArrowDown"]), { x: 0, y: -1 });
assert.deepEqual(panDirection(["ArrowLeft"]), { x: 1, y: 0 });
assert.deepEqual(panDirection(["ArrowRight"]), { x: -1, y: 0 });

assert.deepEqual(panDirection([]), { x: 0, y: 0 }, "nothing held is not a direction");
assert.deepEqual(panDirection(["KeyQ"]), { x: 0, y: 0 }, "an unrelated key moves nothing");
assert.deepEqual(panDirection(["ArrowUp", "ArrowDown"]), { x: 0, y: 0 }, "opposite keys cancel");

// Two keys is a diagonal, not a sprint.
const diagonal = panDirection(["ArrowUp", "ArrowLeft"]);
assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9, "a diagonal travels at the same speed as a straight line");

// --------------------------------------------------
// THE EASING
// --------------------------------------------------

// It starts from rest and climbs toward the target without ever passing it.
let v = 0;
let previous = -1;

for (let frame = 0; frame < 120; frame += 1) {
    v = panVelocity(v, PAN_SPEED, 1 / 60);
    assert.ok(v > previous, "speed climbs while the key is held");
    assert.ok(v <= PAN_SPEED, `speed overshot the target: ${v}`);
    previous = v;
}

assert.ok(v > PAN_SPEED * 0.99, "a held key reaches full speed");

// One time constant covers about two thirds of the gap. This is the number
// that decides whether the start feels sharp or sluggish, so it is pinned.
assert.ok(Math.abs(panVelocity(0, 1000, PAN_TAU) - 632) < 2, "one tau covers ~63% of the gap");

// Released, it glides back to rest rather than stopping dead.
let glide = PAN_SPEED;
const first = glide - panVelocity(glide, 0, 1 / 60);
glide = panVelocity(glide, 0, 1 / 60);

assert.ok(glide > 0 && glide < PAN_SPEED, "releasing the key does not stop the map dead");
assert.ok(first < PAN_SPEED, "and does not stop it in one frame");

for (let frame = 0; frame < 120; frame += 1) glide = panVelocity(glide, 0, 1 / 60);
assert.ok(glide < 2, "the glide settles");

// --------------------------------------------------
// THE SAME MOTION ON ANY DISPLAY
// --------------------------------------------------
// Framed in seconds, not frames: a 120Hz display must not scroll twice as
// fast as a 60Hz one, and a frame the browser skipped must not become a jump.

const after = (fps, seconds) => {
    let speed = 0;
    for (let frame = 0; frame < fps * seconds; frame += 1) speed = panVelocity(speed, PAN_SPEED, 1 / fps);
    return speed;
};

assert.ok(Math.abs(after(60, 0.2) - after(120, 0.2)) < 1, "60Hz and 120Hz reach the same speed");
assert.ok(Math.abs(after(60, 0.2) - after(30, 0.2)) < 5, "a dropped frame does not change where the motion is");

// A frame with no time in it changes nothing, rather than dividing by zero.
assert.equal(panVelocity(100, 900, 0), 100);
assert.equal(panVelocity(100, 900, -1), 100);

// Shift is faster, not a different feel.
assert.ok(PAN_FAST > 1);
assert.ok(panVelocity(0, PAN_SPEED * PAN_FAST, 1 / 60) > panVelocity(0, PAN_SPEED, 1 / 60));

// --------------------------------------------------
// THE MAP STAYS WHERE IT CAN BE READ
// --------------------------------------------------
// The journey runs bottom to top, so sideways is not a direction of travel.
// An axis that fits is centred and held there; one that does not may be
// moved, but only as far as its own edges. Panning used to be unbounded, so
// the map could be pushed off-screen with nothing to say where it went.

const fits = pan => panAxis({ from: 100, to: 500, pan, extent: 1000 });
const centred = 500 - 300;

assert.equal(fits(0), centred, "content that fits is centred");
assert.equal(fits(9000), centred, "and shoving it sideways changes nothing");
assert.equal(fits(-9000), centred);
assert.equal(fits(centred), centred, "already centred stays put");

// Wider than the canvas: it may move, within its own edges.
const wide = pan => panAxis({ from: 0, to: 3000, pan, extent: 1000, edge: 40 });

assert.equal(wide(-500), -500, "a position inside the bounds is left alone");
assert.equal(wide(9000), 40, "it cannot be pulled past its leading edge");
assert.equal(wide(-9000), 1000 - 40 - 3000, "nor past its trailing one");
assert.ok(wide(-9000) < wide(9000));

// Scale counts: the same content zoomed in stops being something that fits.
assert.equal(
    panAxis({ from: 0, to: 900, pan: 0, extent: 1000, scale: 1 }),
    1000 / 2 - 450,
    "at 100% it fits and is centred"
);
assert.equal(
    panAxis({ from: 0, to: 900, pan: -5000, extent: 1000, scale: 2, edge: 40 }),
    1000 - 40 - 1800,
    "at 200% it no longer fits, and clamps instead"
);

// A single card is centred, not pinned to a corner.
assert.equal(panAxis({ from: 300, to: 472, pan: 0, extent: 900 }), 450 - 386);

// --------------------------------------------------
// MARGIN FURNITURE DOES NOT PULL THE CONTENT OFF CENTRE
// --------------------------------------------------
// A feature's lane labels sit left of its steps. They have to fit on screen
// and be reachable, but the steps are what the eye centres on: a measured
// feature put its one column 144px right of the middle because 252px of
// label gutter was being centred along with it.

const oneCard = { from: 312, to: 484, pan: 0, extent: 1500, scale: 1, edge: 40 };

assert.equal(
    panAxis({ ...oneCard, padStart: 170 }) + (312 + 86),
    1500 / 2,
    "the step lands dead centre, whatever is drawn beside it"
);
assert.equal(
    panAxis({ ...oneCard, padStart: 170 }),
    panAxis({ ...oneCard, padStart: 0 }),
    "furniture never moves the centre"
);

// It does decide whether the picture fits. With enough of it, the content
// stops being centred and starts being clamped.
const tight = { from: 0, to: 900, pan: -5000, extent: 1000, scale: 1, edge: 40 };
assert.equal(panAxis({ ...tight, padStart: 0 }), 1000 / 2 - 450, "900 in 1000 fits");
assert.equal(
    panAxis({ ...tight, padStart: 300 }),
    1000 - 40 - 900,
    "900 plus 300 of furniture does not, so it clamps"
);

// And when it clamps, the furniture is reachable: the content can be pulled
// far enough right to bring its left margin on screen.
assert.equal(
    panAxis({ from: 0, to: 900, pan: 99999, extent: 1000, scale: 1, edge: 40, padStart: 300 }),
    40 + 300,
    "the leading edge accounts for the margin, so a label can be panned to"
);

// --------------------------------------------------
// WHAT THE VIEW DOES WITH IT
// --------------------------------------------------

assert.match(main, /const heldPanKeys = new Set\(\);/);

// Every way the map moves by hand goes through the clamp: keys, dragging,
// and zooming. The fit and the fly-in set the view outright and are the
// authority on where it lands.
assert.match(main, /panBy\(dx, dy\) \{ panX \+= dx; panY \+= dy; clampPan\(\);/);
assert.match(main, /if \(panning\) \{[\s\S]{0,200}clampPan\(\);/);
assert.equal(
    (main.match(/clampPan\(\);/g) ?? []).length,
    8,
    "keys, drag, the wheel and zoom move the map; so do holding a row in "
    + "place, bringing a keyboard-focused card into view, focusing a step, "
    + "and a canvas resize"
);

// What gets centred is the steps. Lane labels are margin furniture: they
// count toward whether the picture fits and how far it may be pulled, never
// toward the middle. Centring a box that contained them centred a mostly
// empty left half and put the steps well right of centre.
assert.match(main, /minX: Math\.min\(\.\.\.xs\),/);
assert.doesNotMatch(main, /Math\.min\(\.\.\.xs\) - insetLeft/);
assert.match(main, /padStart: insetLeft/, "the clamp still supports a left margin");

// Nothing is drawn beside the column any more. The lanes are gone, and the
// terms, preconditions and helpers are rows IN the column rather than
// bands off to one side - so there is no furniture to measure.
assert.doesNotMatch(main, /asideInset/, "nothing computes a left inset");
assert.doesNotMatch(main, /BAND_GUTTER/, "the lane labels are gone");
assert.doesNotMatch(main, /ASIDE_REACH/, "the chip bands beside the spine are gone");

assert.match(main, /minY: Math\.min\(\.\.\.nodes\.map\(n => n\.y\)\) - insetTop/);
assert.match(main, /maxY: Math\.max\(\.\.\.nodes\.map\(n => n\.y \+ heightOf\(n\)\)\) \+ insetBottom/);
assert.match(main, /panBy\(dx, dy\)/, "the graph exposes a way to be moved");
assert.match(main, /panBy\(dx, dy\)/, "the graph exposes a way to be moved");

// The operating system's key repeat is ignored - holding a key is one press
// here, and the frame loop supplies the movement.
assert.match(main, /if \(event\.repeat\) return;/);

// A key held while the webview loses focus never sends its keyup.
assert.match(main, /window\.addEventListener\("blur", \(\) => \{\s*heldPanKeys\.clear\(\);/);

// Typing owns its arrow keys, and so does a flight already animating the
// same transform.
assert.match(main, /if \(flying\) return false;/);
assert.match(main, /target\?\.isContentEditable/);
assert.match(main, /activeView !== "planmap"/);

// Reduced motion still gets to walk the map, just without the easing.
assert.match(main, /if \(reducedMotion\.matches\)/);

// The loop stops itself once the glide has settled, rather than repainting
// forever for motion nobody can see.
assert.match(main, /heldPanKeys\.size === 0 && Math\.hypot\(panVX, panVY\) < PAN_REST/);
assert.match(main, /cancelAnimationFrame\(panFrameId\)/);

// A key still held while the view flies to another level must not go on
// moving whichever graph lands in front of it.
assert.equal(
    (main.match(/stopPanning\(\);\s*\n\s*heldPanKeys\.clear\(\);/g) ?? []).length,
    2,
    "both descend and ascend release a held key"
);

// --------------------------------------------------
// THE MAP FOLLOWS THE CANVAS
// --------------------------------------------------
// The detail panel is a flex sibling of the canvas, so opening it narrows
// the canvas over the 280ms its width animates. The map used to ignore that
// and then jump sideways the next time anything touched the pan, because
// that was the first moment the centring was recomputed.

assert.match(main, /new ResizeObserver\(/);
assert.match(main, /canvasResize\.observe\(canvasEl\)/);

// A flight owns the transform while it runs.
assert.match(main, /if \(contentEl\.classList\.contains\("flying"\) \|\| !nodes\.length\) return;/);

// No transition of its own: one would restart on every notification and lag
// behind the thing it is following.
assert.doesNotMatch(main, /settling/);

// --------------------------------------------------
// THE FIT AND THE CLAMP MEASURE THE SAME THING
// --------------------------------------------------
// They used to differ: the fit centred the column of cards, the clamp
// centred the whole picture including the lane labels beside them. So the
// first recompute stepped the map sideways by half the width of that
// furniture - about 20px on a measured feature, on every panel open.

assert.match(main, /function fitView\(\) \{[\s\S]{0,400}const box = contentBox\(\);/);
assert.match(main, /const \{ minX, maxX, minY, maxY \} = box;/);
assert.equal(
    (main.match(/function contentBox\(\)/g) ?? []).length,
    1,
    "one definition of what the content is, measured once"
);

// Every direction the view knows about is one the maths knows about.
assert.deepEqual(Object.keys(PAN_DIRECTIONS).sort(), ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"]);

console.log("PASS: arrow-pan");
