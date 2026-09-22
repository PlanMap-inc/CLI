import assert from "node:assert/strict";

import {
    buildSpine,
    detailLine,
    lensCoverage
} from "../webview/model.js";

// --------------------------------------------------
// A LENS FOLDS; IT NEVER RENAMES
// --------------------------------------------------
// A perspective is a way of reading one journey, not a second journey. So
// the titles, the numbers and the order hold still, the steps the lens
// speaks to are outlined in its colour, and the runs in between fold into
// a row that says how many are there.
//
// Folding rather than hiding, because a reader has to be able to see that
// something was left out, and open it.
// --------------------------------------------------

const step = (id, order, tags, extra = {}) => ({
    id,
    feature: "f",
    identity: `src/a.js::${id}:function`,
    role: "behaviour",
    title: `Step ${id}`,
    intent: "x",
    step: order,
    lensTags: tags,
    rules: [],
    edgesOut: [],
    status: "intended",
    origin: "ai_drafted",
    ...extra
});

const LENSES = [{ id: "security", label: "Security" }, { id: "backend", label: "Backend" }];

const planOf = nodes => ({ version: 1, lenses: LENSES, features: [{ id: "f", name: "F" }], nodes });

const nodes = [
    step("a", 1, ["security"]),
    step("b", 2, ["backend"]),
    step("c", 3, ["backend"]),
    step("d", 4, ["security", "backend"]),
    step("e", 5, [])
];

const build = (options = {}) => buildSpine(planOf(nodes), "f", options);
const steps = spine => spine.items.filter(item => item.kind === "step");


// --------------------------------------------------
// EVERY TITLE IS THE SAME UNDER EVERY LENS
// --------------------------------------------------

const allFolds = ["fold:b", "fold:e", "fold:a", "fold:c"];

for (const lensId of [null, "security", "backend"]) {
    const spine = build({ lensId, openFolds: allFolds });

    assert.deepEqual(
        steps(spine).map(item => [item.id, item.node.title, item.number]),
        [["a", "Step a", "1"], ["b", "Step b", "2"], ["c", "Step c", "3"], ["d", "Step d", "4"], ["e", "Step e", "5"]],
        `${lensId} changed a title, a number or the order`
    );
}

// A reading shows as the detail line, under the step's own name.
const withReading = { ...nodes[0], readings: { security: "Refuse a token the caller may not hold" } };

assert.equal(detailLine(withReading, { lensId: "security" }).kind, "reading");
assert.equal(detailLine(withReading, { lensId: "security" }).text, "Refuse a token the caller may not hold");
assert.equal(detailLine(withReading, { lensId: "backend" }), null, "a lens with nothing to say here says nothing");


// --------------------------------------------------
// A RUN OUTSIDE THE LENS BECOMES ONE ROW
// --------------------------------------------------

const security = build({ lensId: "security" });

assert.deepEqual(
    security.items.map(item => item.kind === "fold" ? item.label : item.id),
    ["a", "2 steps outside Security", "d", "1 step outside Security"],
    "consecutive runs fold, and each says how many"
);

assert.ok(security.items.filter(item => item.kind === "fold").every(row => row.open === false));

// The steps the lens does speak to say so, so the view can outline them.
assert.deepEqual(steps(security).map(item => item.owns), [true, true]);

// Nothing is lost: every folded step is named by the row that holds it.
assert.deepEqual(
    [...security.hiddenIn.keys()].sort(),
    ["b", "c", "e"]
);


// --------------------------------------------------
// OPENING A ROW SHOWS THEM MUTED, IN PLACE
// --------------------------------------------------

const foldId = security.items.find(item => item.kind === "fold").id;
const opened = build({ lensId: "security", openFolds: [foldId] });

assert.deepEqual(
    opened.items.map(item => item.kind === "fold" ? item.label : item.id),
    ["a", "Fold 2 steps outside Security", "b", "c", "d", "1 step outside Security"],
    "the row changes to a way of folding them back"
);

assert.deepEqual(
    opened.items.filter(item => item.kind === "step").map(item => Boolean(item.muted)),
    [false, true, true, false],
    "and they are visibly not what the lens is about"
);


// --------------------------------------------------
// A DRIFTED CARD KEEPS ITS RED BORDER UNDER A LENS
// --------------------------------------------------
// A problem outranks a category. The lens outline is applied through the
// `owns` flag; the status is what decides the border colour, and the CSS
// gives the drifted border the last word.

const drifted = buildSpine(
    planOf(nodes.map(node => ({ ...node, status: "approved", version: 1 }))),
    "f",
    {
        lensId: "security",
        verifiedStatus: { "src/a.js::a:function": { status: "drifted", verifiedAgainst: "a@1" } }
    }
);

const card = steps(drifted).find(item => item.id === "a");

assert.equal(card.status, "drifted", "the lens does not soften the status");
assert.equal(card.owns, true, "and the step is still the lens's own");

const css = await import("node:fs").then(fs =>
    fs.readFileSync(new URL("../webview/styles.css", import.meta.url), "utf8"));

assert.match(
    css,
    /\.gnode\.status-drifted\.owns[^}]*!important/,
    "the drifted border wins over the lens outline"
);


// --------------------------------------------------
// lensCoverage COUNTS STEPS, AND ONLY STEPS
// --------------------------------------------------
// It used to count every node in the feature, so a feature whose terms and
// preconditions carried a lens showed one number on the pill and another
// on the line below it.

const withRegisters = planOf([
    ...nodes,
    { id: "m1", feature: "f", title: "Connect the pool", intent: "x", role: "machinery", lensTags: ["backend"] },
    { id: "v1", feature: "f", title: "Question ids", intent: "x", role: "vocabulary", lensTags: ["backend"] }
]);

assert.deepEqual(
    lensCoverage(withRegisters, "f"),
    [
        { id: "security", label: "Security", count: 2, empty: false },
        { id: "backend", label: "Backend", count: 3, empty: false }
    ],
    "the machinery and vocabulary nodes tagged backend are not steps"
);

// A lens no step carries is empty, and the bar hides it.
assert.equal(
    lensCoverage(planOf([step("z", 1, [])]), "f").every(lens => lens.empty),
    true
);


// --------------------------------------------------
// ENTERING A FEATURE SELECTS All
// --------------------------------------------------
// It used to switch the first lens on, so the first titles a reader ever
// saw were a perspective's rewording of the plan rather than the plan.

const main = await import("node:fs").then(fs =>
    fs.readFileSync(new URL("../webview/main.js", import.meta.url), "utf8"));

assert.match(main, /currentLensId = null;/, "no lens is the default");
assert.doesNotMatch(main, /currentLensId = coveredLenses\(\)\[0\]/, "and entering a feature does not pick one");
assert.match(main, /class="lens-btn all/, "All comes before the lens pills");
assert.match(main, /next === currentLensId \? null : next/, "clicking the active lens returns to All");

console.log("PASS: lens-fold");
