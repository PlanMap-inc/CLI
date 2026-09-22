import assert from "node:assert/strict";

import { findSteps, FIND_RESULTS, FLAT_LIMIT } from "../webview/model.js";

// --------------------------------------------------
// FINDING A STEP THE FOLD HAS PUT AWAY
// --------------------------------------------------
// A folded feature and a summary step both mean a step can be on screen
// without being visible. If finding one stopped working there, the cap and
// the fold would both be ways of losing code - which is the one thing they
// must never be.
// --------------------------------------------------

const plan = {
    version: 1,
    lenses: [],
    features: [{ id: "f", name: "Survey" }, { id: "g", name: "Login" }],
    nodes: [
        {
            id: "s1", feature: "f", step: 1, role: "behaviour",
            identity: "src/survey.controller.js::submitSurvey:function",
            title: "Record the submitted answers", intent: "x"
        },
        {
            id: "s2", feature: "f", step: 2, role: "behaviour",
            identity: "src/risk.py::agency_risk:function",
            identities: ["src/risk.py::agency_risk:function", "src/risk.py::mp_risk:function"],
            merge: "summary",
            summaryOf: [
                { identities: ["src/risk.py::agency_risk:function"], title: "Score an agency's risk" },
                { identities: ["src/risk.py::mp_risk:function"], title: "Score an MP's risk" }
            ],
            title: "Score risk across the register", intent: "x"
        },
        {
            id: "v1", feature: "f", role: "vocabulary",
            identity: "src/survey.js::QUESTIONS:data",
            title: "Survey questions", intent: "x"
        },
        {
            id: "g1", feature: "g", step: 1, role: "behaviour",
            identity: "src/auth.js::verifyToken:function",
            title: "Refuse an expired token", intent: "x"
        }
    ]
};

const ids = query => findSteps(plan, query).map(hit => hit.id);


// --------------------------------------------------
// BY TITLE, BY FUNCTION, BY FILE
// --------------------------------------------------

assert.deepEqual(ids("submitted"), ["s1"], "by title");
assert.deepEqual(ids("submitSurvey"), ["s1"], "by function name");
assert.deepEqual(ids("survey.controller.js"), ["s1"], "by file name");
assert.deepEqual(ids("SUBMITSURVEY"), ["s1"], "case-insensitive");
assert.deepEqual(ids("verifyToken"), ["g1"], "across features");

// A term is not a step, so it is never a result - the column would have
// nowhere to take you.
assert.deepEqual(ids("QUESTIONS"), [], "a term is not a step");


// --------------------------------------------------
// INTO WHAT A SUMMARY STEP COVERS
// --------------------------------------------------
// Otherwise folding a feature would make the steps inside it unfindable.

assert.deepEqual(ids("MP's risk"), ["s2"], "by a covered step's title");
assert.deepEqual(ids("mp_risk"), ["s2"], "and by a covered declaration's name");


// --------------------------------------------------
// WHAT A RESULT CARRIES
// --------------------------------------------------
// Enough to get there: the feature to enter, the part to open, and the
// node to select.

const [hit] = findSteps(plan, "submitted");

assert.deepEqual(hit, {
    id: "s1",
    title: "Record the submitted answers",
    feature: "f",
    featureName: "Survey",
    part: null,
    label: "Record the submitted answers · Survey"
});

// In a folded feature the result names the part that holds it.
const long = {
    ...plan,
    nodes: Array.from({ length: FLAT_LIMIT + 3 }, (_, at) => ({
        id: `n${at}`,
        feature: "f",
        step: at + 1,
        role: "behaviour",
        identity: `src/a.js::n${at}:function`,
        title: `Weigh the parcel ${at}`,
        intent: "x",
        path: [at < 5 ? "Depot" : "Road"]
    }))
};

assert.equal(findSteps(long, "parcel 9")[0].part, "part:Road", "the part to open");
assert.equal(findSteps(long, "parcel 1")[0].part, "part:Depot");


// --------------------------------------------------
// AT MOST EIGHT, AND NEVER ON AN EMPTY QUERY
// --------------------------------------------------

assert.equal(findSteps(long, "parcel").length, FIND_RESULTS);
assert.equal(FIND_RESULTS, 8);

for (const query of ["", "   ", null, undefined]) {
    assert.deepEqual(findSteps(plan, query), [], `"${query}" is not a search`);
}

assert.deepEqual(findSteps(null, "anything"), []);
assert.deepEqual(ids("nothing matches this"), []);

console.log("PASS: find-steps");
