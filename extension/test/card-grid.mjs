import assert from "node:assert/strict";
import fs from "node:fs";

import {
    buildConstellation,
    buildSpine,
    CARD_METRICS,
    CARD_W,
    FEATURE_CARD_ROWS,
    FEATURE_H,
    followDetail,
    toolbarLayout,
    hasToolbar,
    isSelectable,
    ROW_H,
    rowHeight,
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

assert.match(main, /followDetail\(activeGraph\(\)\.nodes, detailNodeId\)/, "the view uses it, on whichever canvas is open");
assert.doesNotMatch(main, /n\.source\.supersedes/, "and no longer reads source blindly");

// --------------------------------------------------
// AN OPEN ROW IS AS TALL AS WHAT IT HOLDS
// --------------------------------------------------
// Terms, Runs on, Helpers and Project setup open into chips. Every item
// on the canvas was 56px whether it was open or shut, and a card clips
// what overflows - so opening one flipped its chevron and showed nothing,
// and no term, precondition or helper could be reached from the graph.

const CHIP = CARD_METRICS["--card-chip-line-h"];

assert.ok(CHIP > 0, "a chip line has a height of its own");

assert.equal(rowHeight({}), ROW_H, "a row with no chips is the plain row");
assert.equal(rowHeight({ open: false, chips: [1, 2, 3] }), ROW_H, "and so is a closed one");
assert.equal(rowHeight({ open: true, chips: [] }), ROW_H, "and one that holds nothing");
assert.equal(rowHeight({ open: true, chips: [1, 2, 3] }), ROW_H + 3 * CHIP, "one line per chip");
assert.equal(rowHeight(undefined), ROW_H);

// Every chip gets its own line, so the height is the chip count and
// nothing has to be measured.
for (const count of [1, 2, 5, 9]) {
    const chips = Array.from({ length: count }, (_, at) => ({ id: `c${at}` }));
    assert.equal(rowHeight({ open: true, chips }), ROW_H + count * CHIP);
}

assert.ok(css.includes("var(--card-chip-line-h)"), "styles.css sizes a chip line from the metric");


// --------------------------------------------------
// AND EVERYTHING BELOW IT MOVES DOWN
// --------------------------------------------------

const step = (id, order, extra = {}) => ({
    id, feature: "f", step: order, role: "behaviour",
    identity: `src/a.js::${id}:function`, title: `Step ${id}`, intent: "x",
    lensTags: [], rules: [], edgesOut: [], status: "intended", origin: "ai_drafted", ...extra
});

const term = (id, title) => ({
    id, feature: "f", role: "vocabulary",
    identity: `src/a.js::${id}:data`, title, intent: "x", lensTags: []
});

const plan = {
    version: 1,
    lenses: [],
    features: [{ id: "f", name: "F" }],
    nodes: [
        term("v1", "One"), term("v2", "Two"), term("v3", "Three"),
        step("a", 1), step("b", 2)
    ]
};

const shut = buildSpine(plan, "f", {});
const open = buildSpine(plan, "f", { openRegisters: ["register:vocabulary"] });

const rowOf = spine => spine.items.find(item => item.kind === "register");
const firstStep = spine => spine.items.find(item => item.kind === "step");

assert.equal(rowOf(shut).h, ROW_H, "a shut Terms row is one line");
assert.equal(rowOf(open).h, ROW_H + 3 * CHIP, "an open one is as tall as its three chips");

assert.equal(
    firstStep(open).y - firstStep(shut).y,
    3 * CHIP,
    "and the step under it moves down by exactly the difference"
);

// The Constellation's setup row is the same row, by the same function.
const constellation = {
    version: 1, lenses: [], features: [{ id: "f", name: "F" }, { id: "g", name: "G" }],
    nodes: [step("a", 1), { ...term("i1", "Boot"), feature: "g" }, { ...term("i2", "Ports"), feature: "g" }]
};

assert.equal(buildConstellation(constellation, {}).setup.h, ROW_H);
assert.equal(
    buildConstellation(constellation, {}, { openRegisters: ["setup"] }).setup.h,
    ROW_H + 2 * CHIP
);
assert.equal(buildConstellation(constellation, {}, { openRegisters: ["setup"] }).setup.open, true);


// --------------------------------------------------
// A CHIP'S PANEL SURVIVES A REFRESH
// --------------------------------------------------
// followDetail only looked at the cards on the canvas, and a term is not
// one - it is a chip in a row beside them. So the panel closed on every
// approve, verify or rescan for anything opened from a chip.

const withChips = [
    { kind: "register", id: "register:vocabulary", chips: [{ id: "v1" }, { id: "v2" }] },
    { kind: "part", id: "part:Read" },
    { kind: "step", id: "plan_0002", source: { id: "plan_0002" } }
];

assert.equal(followDetail(withChips, "plan_0002")?.id, "plan_0002", "a step is still found first");
assert.deepEqual(followDetail(withChips, "v1"), { chip: true, id: "v1" }, "and so is a chip");
assert.deepEqual(followDetail(withChips, "v2"), { chip: true, id: "v2" });
assert.equal(followDetail(withChips, "nothing"), null);
assert.equal(followDetail([{ kind: "part", id: "part:Read" }], "v1"), null, "a row with no chips holds none");

assert.match(main, /same\?\.chip/, "the view opens a chip's node by id");


// --------------------------------------------------
// THE TOP BAR REFLOWS RATHER THAN HIDING A LENS
// --------------------------------------------------
// It used to scroll inside its own column with the scrollbar hidden, so a
// lens that did not fit was simply gone - and with a lens on, the bar
// scrolled far enough that "All", the only way to turn it off, went too.

assert.equal(toolbarLayout({ available: 1000, crumb: 200, lens: 400, actions: 300 }), "one-row");

// One pixel too wide, and the lens bar takes a row of its own.
// 200 + 400 + 300 and two 14px gaps is 928.
assert.equal(toolbarLayout({ available: 928, crumb: 200, lens: 400, actions: 300 }), "one-row");
assert.equal(toolbarLayout({ available: 927, crumb: 200, lens: 400, actions: 300 }), "lens-row");

// Too narrow even for the breadcrumb and the actions, and all three stack.
assert.equal(toolbarLayout({ available: 514, crumb: 200, lens: 400, actions: 300 }), "lens-row");
assert.equal(toolbarLayout({ available: 513, crumb: 200, lens: 400, actions: 300 }), "stacked");

// The Constellation has no lens bar at all, and must not be pushed onto
// two rows by one that is not there.
assert.equal(toolbarLayout({ available: 600, crumb: 200, lens: 0, actions: 300 }), "one-row");
assert.equal(toolbarLayout({ available: 400, crumb: 200, lens: 0, actions: 300 }), "stacked");

assert.equal(toolbarLayout({}), "stacked", "nothing measured yet is the safe answer");

// The decision is never taken from a width the layout itself produced.
assert.match(main, /pills\.reduce\(\(total, pill\) => total \+ pill\.offsetWidth, 0\)/,
    "the lens bar is measured as the sum of its pills");
assert.match(main, /new ResizeObserver\(\(\) => layOutToolbar\(\)\)/, "and re-measured when the bar resizes");
assert.doesNotMatch(css, /@media \(max-width:820px\)/, "the fixed-width fallback is gone");
assert.doesNotMatch(css, /overflow-x: ?auto/, "and nothing in the bar scrolls");

for (const layout of ["one-row", "lens-row", "stacked"]) {
    assert.ok(css.includes(`.toolbar.layout-${layout}`), `styles.css has no rule for ${layout}`);
}


// --------------------------------------------------
// WHAT NO LONGER RENDERS HAS NO CSS
// --------------------------------------------------
// The areas level is gone, and one of its rules - .gnode .exit, pinned
// bottom-right - still matched the "↗ Feature" chip and sat on top of the
// status pill.

for (const dead of [".gnode .exit", ".gnode.area", "#areasContent", ".gnode .node-calls"]) {
    assert.ok(!css.includes(dead), `styles.css still styles ${dead}, which nothing renders`);
    assert.ok(!main.includes(dead.replace(/^[.#]/, "").split(" ").pop()) || dead === ".gnode .exit",
        `${dead} may still be rendered - check before deleting its rule`);
}

// Nothing in the footer is taken out of the flow.
assert.doesNotMatch(css, /\.gnode[^{]*\.exit[^{]*\{[^}]*position: ?absolute/);
assert.match(css, /\.gnode \.node-foot \.calls-chip\{flex: ?0 1 auto/, "the chip is what shrinks");
assert.match(css, /\.gnode \.status-pill\{[^}]*flex: ?0 0 auto/, "and the status never does");

// The lens dots carry no margin of their own: they sit in a row that has
// a height, and the margin pushed them below their own text in a row.
assert.doesNotMatch(css, /\.node-lenses\{[^}]*margin-top/);

// The reading's detail line is a block container, so its ellipsis works.
assert.doesNotMatch(css, /\.node-detail\.reading[^}]*display: ?flex/,
    "text-overflow does nothing on a flex container");

console.log("PASS: card-grid");
