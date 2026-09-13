import assert from "node:assert/strict";
import { buildCallerIndex } from "../../src/dependencies/callers.js";

const PROTOTYPE_CALLEES = [
    "toString",
    "valueOf",
    "constructor",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
    "__proto__"
];


// ------------------------------------------------------------
// EACH PROTOTYPE-NAMED CALLEE GETS ITS OWN, CORRECT ENTRY
// ------------------------------------------------------------

const declarations = PROTOTYPE_CALLEES.map(
    (callee, index) => ({
        identity: `fixture.js::caller${index}:function`,
        properties: { calls: [callee] }
    })
);

const callerIndex = buildCallerIndex(declarations);

for (const callee of PROTOTYPE_CALLEES) {
    assert.ok(
        Array.isArray(callerIndex[callee]),
        `callerIndex["${callee}"] must be an array, got ${typeof callerIndex[callee]}`
    );

    assert.equal(
        callerIndex[callee].length,
        1,
        `callerIndex["${callee}"] must have exactly one caller edge`
    );
}


// ------------------------------------------------------------
// THE INDEX CONTAINS EXACTLY THE EXPECTED KEYS
// ------------------------------------------------------------

assert.deepEqual(
    Object.keys(callerIndex).sort(),
    [...PROTOTYPE_CALLEES].sort()
);


// ------------------------------------------------------------
// MULTIPLE CALLERS OF THE SAME PROTOTYPE-NAMED CALLEE STILL DEDUPLICATE
// ------------------------------------------------------------

const sharedDeclarations = [
    {
        identity: "a.js::first:function",
        properties: { calls: ["toString"] }
    },
    {
        identity: "b.js::second:function",
        properties: { calls: ["toString"] }
    },
    {
        identity: "a.js::first:function",
        properties: { calls: ["toString"] }
    }
];

const sharedIndex = buildCallerIndex(sharedDeclarations);

assert.equal(
    sharedIndex.toString.length,
    2,
    "duplicate caller edges for the same identity must still collapse to one"
);

console.log("PASS: prototype key regression");
