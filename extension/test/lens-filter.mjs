import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    FEATURE_PALETTE,
    LENS_IDS,
    LENS_PALETTE,
    buildConstellation,
    buildSpine,
    colorAt,
    detailLine,
    lensColors
} from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Filtering on lensTags: a lens shows only its nodes, and edges between them.
const plan = {
    features: [{ id: "f", name: "F" }],
    nodes: [
        { id: "n1", feature: "f", lensTags: ["security", "backend"], edgesOut: ["n2"] },
        { id: "n2", feature: "f", lensTags: ["backend"], edgesOut: ["n3"] },
        { id: "n3", feature: "f", lensTags: [], edgesOut: [] },
        { id: "n4", feature: "f" }
    ]
};
// A lens is a reading of the journey, not a filter over it: the same steps,
// in the same places, whichever lens is on. What changes is which of them
// the lens speaks to - and a run it has nothing to say about folds into a
// row that says how many are there, so a reader can see what is left out
// and open it.
const spine = (lensId, options = {}) => buildSpine(plan, "f", { lensId, ...options });
const steps = result => result.items.filter(item => item.kind === "step");

assert.deepEqual(steps(spine(null)).map(item => item.id), ["n1", "n2", "n3", "n4"], "no lens: every step");

// With a lens on, the steps it does not speak to are folded rather than
// dropped - and the fold says how many.
const security = spine("security");
const folds = security.items.filter(item => item.kind === "fold");

assert.deepEqual(steps(security).map(item => item.id), ["n1"], "only the lens's own steps are cards");
assert.equal(folds.length, 1, "the rest fold into one row");
assert.equal(folds[0].count, 3);
assert.equal(folds[0].open, false);

// Nothing is lost: every step is accounted for, on a card or behind a row.
assert.deepEqual(
    [...steps(security).map(item => item.id), ...security.hiddenIn.keys()].sort(),
    ["n1", "n2", "n3", "n4"],
    "a fold hides nothing it does not name"
);

// Opening the row shows those steps in place, muted.
const opened = spine("security", { openFolds: [folds[0].id] });

assert.deepEqual(steps(opened).map(item => item.id), ["n1", "n2", "n3", "n4"], "every step is back");
assert.deepEqual(
    steps(opened).filter(item => item.muted).map(item => item.id),
    ["n2", "n3", "n4"],
    "and the ones outside the lens are visibly so"
);
assert.match(opened.items.find(item => item.kind === "fold").label, /^Fold 3 steps outside/);

// The numbers never move. A step is the same step under every lens.
for (const lensId of [null, "security", "backend"]) {
    const numbered = buildSpine(plan, "f", { lensId, openFolds: ["fold:n2", "fold:n1", "fold:n3", "fold:n4"] });

    assert.deepEqual(
        Object.fromEntries(steps(numbered).map(item => [item.id, item.number])),
        { n1: "1", n2: "2", n3: "3", n4: "4" },
        `${lensId} renumbered the feature`
    );
}

// --------------------------------------------------
// A LENS NEVER RENAMES
// --------------------------------------------------
// It used to replace each card's title with that perspective's reading, so
// the same step appeared under four different names depending on which
// pill was lit - and entering a feature switched the first lens on, so the
// titles a reader saw first were never the plan's.
//
// A reading is shown as the card's detail line instead: the perspective
// still speaks, under the step's own name.

const readable = {
    features: [{ id: "g", name: "G" }],
    lenses: [{ id: "frontend", label: "Frontend" }, { id: "security", label: "Security" }, { id: "database", label: "Database" }],
    nodes: [
        {
            id: "r1", feature: "g", title: "Sign in with Google", step: 1,
            lensTags: ["frontend", "security"], edgesOut: ["r2"],
            readings: {
                frontend: "Press the Google sign-in button",
                security: "Hand Google's token over to be checked"
            }
        },
        { id: "r2", feature: "g", title: "Save the answers", step: 2, lensTags: ["database"], readings: { database: "INSERT one row per answer" } }
    ]
};

const titleAt = lensId =>
    Object.fromEntries(
        buildSpine(readable, "g", { lensId, openFolds: ["fold:r1", "fold:r2"] })
            .items.filter(item => item.kind === "step")
            .map(item => [item.id, item.node.title]));

for (const lensId of [null, "frontend", "security", "database"]) {
    assert.deepEqual(
        titleAt(lensId),
        { r1: "Sign in with Google", r2: "Save the answers" },
        `${lensId} renamed a step`
    );
}

// The reading is on the detail line, where it belongs.
assert.equal(
    detailLine(readable.nodes[0], { lensId: "frontend" }).text,
    "Press the Google sign-in button"
);
assert.equal(
    detailLine(readable.nodes[0], { lensId: "database" }),
    null,
    "a lens with no reading for this step says nothing rather than inventing one"
);

// Nothing is reordered either: the same steps, in the same order, in the
// same column, under every lens. Their y can shift, because a fold row is
// a real row on the line and takes space - but a step never changes place
// relative to the steps around it, and never changes its number.
const frame = lensId => {
    const built = buildSpine(readable, "g", { lensId, openFolds: ["fold:r1", "fold:r2"] });

    return JSON.stringify(built.items
        .filter(item => item.kind === "step")
        .map(item => [item.id, item.number, item.x]));
};

for (const lensId of [null, "frontend", "security", "database"]) {
    assert.equal(frame(lensId), frame(null), `${lensId} moved a step`);
}

// And the column always reads downwards, whatever is folded into it.
for (const lensId of [null, "frontend", "security", "database"]) {
    const built = buildSpine(readable, "g", { lensId, openFolds: ["fold:r1", "fold:r2"] });
    const ys = built.items.map(item => item.y);

    assert.deepEqual(ys, [...ys].sort((a, b) => a - b), `${lensId} broke the column order`);
}

// A lens outside PlanMap's vocabulary is coloured by its position.
const django = { lenses: [{ id: "models", label: "Models" }, { id: "views", label: "Views" }, { id: "tasks", label: "Tasks" }] };
assert.deepEqual(lensColors(django), { models: LENS_PALETTE[0], views: LENS_PALETTE[1], tasks: LENS_PALETTE[2] });

// One in the vocabulary is coloured by its place there instead, wherever the
// plan happens to list it: the same perspective must be the same colour in
// the Plan Graph and in Project Evolution, which orders tags independently.
const [first, second] = LENS_IDS;
const shuffled = { lenses: [{ id: second, label: second }, { id: first, label: first }] };
assert.equal(lensColors(shuffled)[second], LENS_PALETTE[LENS_IDS.indexOf(second)]);
assert.equal(lensColors(shuffled)[first], LENS_PALETTE[LENS_IDS.indexOf(first)]);
assert.deepEqual(
    LENS_IDS.map(id => lensColors({ lenses: [{ id }] })[id]),
    LENS_IDS.map((id, index) => LENS_PALETTE[index]),
    "every lens has its own colour, and no two share one"
);

// More than seven cycles back to the start.
const many = { lenses: Array.from({ length: 9 }, (_, i) => ({ id: `lens${i}`, label: `Lens ${i}` })) };
const colors = lensColors(many);
assert.equal(colors.lens7, LENS_PALETTE[0]);
assert.equal(colors.lens8, LENS_PALETTE[1]);
assert.equal(colorAt(FEATURE_PALETTE, 7), FEATURE_PALETTE[0]);

// Features too.
const features = { features: Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, name: `F${i}` })), nodes: [] };
const constellation = buildConstellation(
    { ...features, nodes: features.features.map((feature, at) => ({ id: `n${at}`, feature: feature.id, title: `S${at}`, step: 1 })) },
    {}
);
assert.deepEqual(constellation.cards.map(n => n.color), [...FEATURE_PALETTE, FEATURE_PALETTE[0]]);

// No lens or feature name is hardcoded in the renderer. model.js declares
// the shared vocabulary - that is an ordering both views read, not a rule
// about one lens - so its names are allowed inside that declaration only.
const VOCABULARY = /export const LENS_IDS = \[[^\]]*\];/;

for (const file of ["model.js", "main.js", "styles.css"]) {
    const source = fs.readFileSync(path.resolve(HERE, "../webview", file), "utf8").replace(VOCABULARY, "");
    assert.doesNotMatch(source, /--lens-|--c-|--tag-|["']security["']|["']business["']|["']database["']/, `${file} hardcodes a lens or feature name`);
}

console.log("PASS: lens-filter");
