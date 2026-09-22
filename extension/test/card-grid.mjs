import assert from "node:assert/strict";
import fs from "node:fs";

import {
    CARD_METRICS,
    CARD_W,
    FEATURE_CARD_ROWS,
    FEATURE_H,
    followDetail,
    hasToolbar,
    isSelectable,
    ROW_H,
    STEP_CARD_ROWS,
    STEP_H,
    cardHeight
} from "../webview/model.js";

const css = fs.readFileSync(new URL("../webview/styles.css", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../webview/main.js", import.meta.url), "utf8");

// --------------------------------------------------
// THE CONSTANTS HAVE TO ADD UP
// --------------------------------------------------
// A card has a fixed height and fixed rows. If the two ever disagree the
// rows have to give way, and in a flex column they give way by shrinking:
// measured in a browser, a 36px title box became 11px for two lines of
// 17.55px type, and the code line and detail line under it were drawn on
// top of each other.
//
// So the height is the sum of the rows, by construction, and this checks
// the arithmetic rather than trusting it.
// --------------------------------------------------

const sum = rows => rows.reduce((total, row) => total + row, 0);

assert.equal(STEP_H, sum(STEP_CARD_ROWS), "a step card's height is its rows plus its padding");
assert.equal(FEATURE_H, sum(FEATURE_CARD_ROWS), "and so is a Constellation card's");

assert.ok(STEP_CARD_ROWS.every(row => row > 0), "no row is zero-height");
assert.ok(FEATURE_CARD_ROWS.every(row => row > 0));

assert.equal(cardHeight(), STEP_H, "every step card is the same height");
assert.equal(cardHeight({ evidence: ["a", "b"], backing: 9 }), STEP_H, "whatever it holds");

// 172px could not hold a real title.
assert.equal(CARD_W, 240);
assert.ok(CARD_W > 172, "the card is wider than it was");


// --------------------------------------------------
// ONE SET OF NUMBERS, NOT TWO
// --------------------------------------------------
// The layout maths and the stylesheet used to declare these separately,
// which is how they came to disagree. model.js owns them; the view writes
// them onto the document as custom properties and styles.css reads them
// from there.

assert.equal(CARD_METRICS["--card-w"], CARD_W);
assert.equal(CARD_METRICS["--card-step-h"], STEP_H);
assert.equal(CARD_METRICS["--card-feature-h"], FEATURE_H);
assert.equal(CARD_METRICS["--card-row-h"], ROW_H);

assert.match(
    main,
    /for \(const \[name, value\] of Object\.entries\(CARD_METRICS\)\) \{\s*document\.documentElement\.style\.setProperty\(name, `\$\{value\}px`\);/,
    "the view hands the metrics to the stylesheet"
);

// Every metric is actually read by the stylesheet, and the stylesheet
// declares no card size of its own.
for (const name of Object.keys(CARD_METRICS)) {
    assert.ok(css.includes(`var(${name})`), `styles.css never reads ${name}`);
}

assert.doesNotMatch(css, /\.gnode\{[^}]*width:172px/, "the old hard-coded card width is gone");
assert.doesNotMatch(css, /\.gnode\{[^}]*min-height:104px/, "and so is the old min-height");


// --------------------------------------------------
// NO ROW MAY SHRINK
// --------------------------------------------------

assert.match(css, /\.gnode>\*\{flex:0 0 auto;\}/, "every row in a card is fixed");
assert.match(css, /\.gnode\.step \{ height: var\(--card-step-h\); \}/);
assert.match(css, /\.gnode\.feature \{ height: var\(--card-feature-h\); \}/);

// The rows that must never wrap or collapse.
for (const [selector, variable] of [
    [/\.gnode \.title\{[^}]*height:var\(--card-title-h\)/, "--card-title-h"],
    [/\.gnode \.sub\{[^}]*height:var\(--card-sub-h\)/, "--card-sub-h"],
    [/\.gnode \.node-detail\{[^}]*height:var\(--card-detail-h\)/, "--card-detail-h"],
    [/\.gnode \.node-foot\{[^}]*height:var\(--card-foot-h\)/, "--card-foot-h"]
]) {
    assert.match(css, selector, `the row sized by ${variable} is not pinned`);
}

// One line each, with an ellipsis rather than a cut mid-letter.
assert.match(css, /\.gnode \.sub\{[^}]*text-overflow:ellipsis/);
assert.match(css, /\.gnode \.node-detail\{[^}]*text-overflow:ellipsis/);
assert.match(css, /\.gnode \.title\{[^}]*-webkit-line-clamp:2/, "the title is clamped to two lines");

// The detail row is drawn even when there is nothing to say, so a card
// without one is the same height as a card with one.
assert.match(main, /<div class="node-detail/, "the detail row is always in the markup");
assert.doesNotMatch(main, /n\.detail \?\s*`<div class="node-detail/, "and never conditional on having content");

// The footer is one line: lens dots, the calls chip and the status pill.
assert.match(css, /\.gnode \.node-foot\{display:flex;align-items:center/);
assert.match(main, /<div class="node-foot">/);


// --------------------------------------------------
// ROWS ARE AS WIDE AS A CARD
// --------------------------------------------------
// A part row read "applicat…" and a fold row read "2 steps out… 2 steps"
// because they were as narrow as the old card and repeated their count.

assert.match(css, /\.gnode\.row \{ width: var\(--card-w\); height: var\(--card-row-h\); \}/);
assert.match(
    main,
    /const count = n\.kind === "part" && n\.count != null/,
    "only a part row carries a separate count; a fold row's label already has one"
);


// --------------------------------------------------
// THE TOOLBAR BELONGS TO A STEP
// --------------------------------------------------
// Selecting a part row or a fold row used to show the step toolbar, and
// its bin sent `reject` with a part id as the target.

assert.equal(hasToolbar({ kind: "step" }), true);

for (const kind of ["part", "fold", "register", "setup", "feature"]) {
    assert.equal(hasToolbar({ kind }), false, `a ${kind} row must not get the step toolbar`);
}

assert.equal(hasToolbar(undefined), false);
assert.equal(hasToolbar({}), false, "an item with no kind is not a step");

// Selecting is the same rule, with one exception: a Constellation card is
// selected to draw its cross-feature call arcs.
assert.equal(isSelectable({ kind: "step" }), true);
assert.equal(isSelectable({ kind: "feature" }), true);

for (const kind of ["part", "fold", "register", "setup"]) {
    assert.equal(isSelectable({ kind }), false, `a ${kind} row is not a node`);
}

assert.match(main, /if \(!hasToolbar\(n\)\) return;/, "the toolbar checks before it renders");
assert.match(main, /if \(isSelectable\(n\)\) select\(n\.id\); else deselect\(\);/);


// --------------------------------------------------
// FOLLOWING THE OPEN PANEL THROUGH A REFRESH
// --------------------------------------------------
// The view walked every item on the canvas reading item.source.supersedes.
// A part row and a fold row have no source, so any refresh in a folded
// feature threw - and took the breadcrumb, the lens bar, the hint and the
// approve button down with it, because none of them ran afterwards.

const items = [
    { kind: "part", id: "part:application", name: "application" },
    { kind: "fold", id: "fold:n3", label: "2 steps outside Security" },
    { kind: "register", id: "register:vocabulary", title: "Terms" },
    { kind: "step", id: "plan_0002", source: { id: "plan_0002" } },
    { kind: "step", id: "plan_0009", source: { id: "plan_0009", supersedes: "plan_0004" } }
];

assert.equal(followDetail(items, "plan_0002")?.id, "plan_0002", "the node itself");
assert.equal(followDetail(items, "plan_0004")?.id, "plan_0009", "or the node that superseded it");
assert.equal(followDetail(items, "gone"), null, "and nothing when it is gone");
assert.equal(followDetail(items, null), null);
assert.equal(followDetail([], "plan_0002"), null);
assert.equal(followDetail(undefined, "plan_0002"), null);

// The rows are skipped rather than read, whatever id is asked for.
for (const id of ["part:application", "fold:n3", "register:vocabulary"]) {
    assert.equal(followDetail(items, id), null, `${id} is not something the panel can hold`);
}

assert.match(main, /followDetail\(featureGraph\.nodes, detailNodeId\)/, "the view uses it");
assert.doesNotMatch(main, /n\.source\.supersedes/, "and no longer reads source blindly");

console.log("PASS: card-grid");
