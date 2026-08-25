import assert from "node:assert/strict";

import {
    findImpact
} from "../../src/dependencies/impact.js";


const graph = {
    nodes: [
        {
            id:
                "auth.ts::verifyToken:function"
        },

        {
            id:
                "auth.ts::loadSession:function"
        },

        {
            id:
                "orders.ts::createOrder:function"
        },

        {
            id:
                "orders.ts::handleOrder:function"
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
                "inferred"
        },

        {
            from:
                "orders.ts::createOrder:function",

            to:
                "auth.ts::loadSession:function",

            kind:
                "call",

            confidence:
                "inferred"
        },

        {
            from:
                "orders.ts::handleOrder:function",

            to:
                "orders.ts::createOrder:function",

            kind:
                "call",

            confidence:
                "inferred"
        },

        {
            from:
                "broken.ts",

            to:
                null,

            kind:
                "import",

            confidence:
                "unresolved",

            reason:
                "module-not-found"
        }
    ]
};


/*
 * ------------------------------------------------------------
 * BASIC IMPACT
 * ------------------------------------------------------------
 */

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
                "inferred"
        },

        {
            identity:
                "orders.ts::createOrder:function",

            depth:
                2,

            kind:
                "call",

            confidence:
                "inferred"
        },

        {
            identity:
                "orders.ts::handleOrder:function",

            depth:
                3,

            kind:
                "call",

            confidence:
                "inferred"
        }
    ]
);


/*
 * ------------------------------------------------------------
 * TARGET IS NOT AN AFFECTED NODE
 * ------------------------------------------------------------
 */

assert.equal(
    result.affected.some(
        item =>
            item.identity ===
            "auth.ts::verifyToken:function"
    ),
    false
);


/*
 * ------------------------------------------------------------
 * DEFAULT DEPTH CAP
 * ------------------------------------------------------------
 */

const depthTwo =
    findImpact(
        graph,
        "auth.ts::verifyToken:function",
        {
            maxDepth:
                2
        }
    );

assert.deepEqual(
    depthTwo.affected.map(
        item =>
            item.identity
    ),
    [
        "auth.ts::loadSession:function",
        "orders.ts::createOrder:function"
    ]
);


/*
 * ------------------------------------------------------------
 * RESULT CAP
 * ------------------------------------------------------------
 */

const capped =
    findImpact(
        graph,
        "auth.ts::verifyToken:function",
        {
            maxResults:
                1
        }
    );

assert.equal(
    capped.affected.length,
    1
);

assert.equal(
    capped.truncated,
    true
);


/*
 * ------------------------------------------------------------
 * UNRESOLVED EDGES ARE COUNTED
 * ------------------------------------------------------------
 */

assert.equal(
    result.unresolved,
    1
);


/*
 * ------------------------------------------------------------
 * INVALID TARGET
 * ------------------------------------------------------------
 */

assert.deepEqual(
    findImpact(
        graph,
        null
    ),
    {
        target:
            null,

        affected:
            [],

        unresolved:
            0,

        truncated:
            false
    }
);


/*
 * ------------------------------------------------------------
 * DETERMINISM
 * ------------------------------------------------------------
 */

assert.deepEqual(
    findImpact(
        graph,
        "auth.ts::verifyToken:function"
    ),
    findImpact(
        graph,
        "auth.ts::verifyToken:function"
    )
);


console.log(
    "PASS: impact analysis regression"
);
