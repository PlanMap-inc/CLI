import assert from "node:assert/strict";

import {
    deriveEvolutionStatus,
    buildEvolutionIdentityIndex,
    applyEvolutionStatus
} from "../../src/evolution/status.js";


/*
 * ------------------------------------------------------------
 * NO PLAN CANNOT PRODUCE DRIFT
 * ------------------------------------------------------------
 */

assert.equal(
    deriveEvolutionStatus({
        identity:
            "src/auth.js::verifyToken:function"
    }),
    "implemented"
);


/*
 * ------------------------------------------------------------
 * UNAPPROVED PLAN CANNOT PRODUCE DRIFT
 * ------------------------------------------------------------
 */

assert.equal(
    deriveEvolutionStatus(
        {
            identity:
                "src/auth.js::verifyToken:function"
        },
        {
            target:
                "src/auth.js::verifyToken:function",

            approved:
                false
        }
    ),
    "implemented"
);


/*
 * ------------------------------------------------------------
 * LATER PLAN-AWARE BRANCH IS STILL CONSERVATIVE
 * ------------------------------------------------------------
 */

assert.equal(
    deriveEvolutionStatus(
        {
            identity:
                "src/auth.js::verifyToken:function"
        },
        {
            target:
                "src/auth.js::verifyToken:function",

            approved:
                true
        }
    ),
    "implemented"
);


/*
 * ------------------------------------------------------------
 * IDENTITY INDEX
 * ------------------------------------------------------------
 */

const nodeA = {
    id:
        "evolution_001",

    identity:
        "src/auth.js::verifyToken:function"
};

const nodeB = {
    id:
        "evolution_002",

    identity:
        "src/auth.js::verifyToken:function"
};

const nodeC = {
    id:
        "evolution_003",

    identity:
        "src/orders.js::createOrder:function"
};

const index =
    buildEvolutionIdentityIndex({
        nodes: [
            nodeA,
            nodeB,
            nodeC
        ]
    });

assert.equal(
    index.size,
    2
);

assert.deepEqual(
    index.get(
        "src/auth.js::verifyToken:function"
    ),
    [
        nodeA,
        nodeB
    ]
);

assert.deepEqual(
    index.get(
        "src/orders.js::createOrder:function"
    ),
    [
        nodeC
    ]
);


/*
 * ------------------------------------------------------------
 * MISSING / MALFORMED NODES ARE SAFE
 * ------------------------------------------------------------
 */

const malformedIndex =
    buildEvolutionIdentityIndex({
        nodes: [
            null,
            {},
            {
                identity:
                    ""
            },
            {
                identity:
                    42
            }
        ]
    });

assert.equal(
    malformedIndex.size,
    0
);


/*
 * ------------------------------------------------------------
 * STATUS APPLICATION
 * ------------------------------------------------------------
 */

const evolution = {
    version:
        1,

    nodes: [
        {
            id:
                "evolution_001",

            identity:
                "src/auth.js::verifyToken:function"
        },

        {
            id:
                "evolution_002",

            identity:
                "src/orders.js::createOrder:function"
        }
    ]
};

const updated =
    applyEvolutionStatus(
        evolution
    );

assert.deepEqual(
    updated.nodes.map(
        node =>
            node.status
    ),
    [
        "implemented",
        "implemented"
    ]
);


/*
 * ------------------------------------------------------------
 * ORIGINAL EVOLUTION IS NOT MUTATED
 * ------------------------------------------------------------
 */

assert.equal(
    evolution.nodes[0].status,
    undefined
);


console.log(
    "PASS: evolution status regression"
);
