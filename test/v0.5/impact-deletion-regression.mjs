import assert from "node:assert/strict";

import {
    findImpact
} from "../../src/dependencies/impact.js";


/*
 * Current graph:
 *
 * verifyToken was deleted from the current declarations,
 * but loadSession still calls it.
 *
 * The caller edge has only the unresolved bare symbol name
 * until check.js anchors it to the baseline identity.
 */
const graph = {
    nodes: [
        {
            id:
                "auth.ts::loadSession:function"
        },

        {
            id:
                "auth.ts::verifyToken:function"
        }
    ],

    edges: [
        {
            from:
                "auth.ts::loadSession:function",

            to:
                "auth.ts::verifyToken:function",

            kind:
                "call",

            confidence:
                "unresolved"
        }
    ]
};


const result =
    findImpact(
        graph,
        "auth.ts::verifyToken:function"
    );


assert.deepEqual(
    result.affected,
    [
        {
            identity:
                "auth.ts::loadSession:function",

            depth:
                1,

            kind:
                "call",

            confidence:
                "unresolved"
        }
    ],
    "deleted declaration must retain its live caller"
);


assert.equal(
    result.affected.some(
        item =>
            item.identity ===
            "auth.ts::verifyToken:function"
    ),
    false
);


console.log(
    "PASS: deletion impact regression"
);
