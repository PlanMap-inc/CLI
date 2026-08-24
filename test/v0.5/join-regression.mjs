import assert from "node:assert/strict";

import {
    joinDependencies,
    buildDeclarationFileIndex
} from "../../src/dependencies/join.js";


const resolverResult = {
    projectRoot:
        "/project",

    edges: [
        {
            from:
                "consumer.ts",

            to:
                "source.ts::validate:function",

            kind:
                "import",

            confidence:
                "certain",

            reason:
                "relative-module-resolved"
        }
    ]
};


const callerIndex = {
    verifyToken: [
        {
            caller:
                "auth.ts::loadSession:function",

            confidence:
                "inferred"
        }
    ]
};


const declarations = [
    {
        identity:
            "auth.ts::loadSession:function",

        file:
            "auth.ts",

        name:
            "loadSession",

        kind:
            "function"
    },

    {
        identity:
            "auth.ts::verifyToken:function",

        file:
            "auth.ts",

        name:
            "verifyToken",

        kind:
            "function"
    },

    {
        identity:
            "orders.ts::createOrder:function",

        file:
            "orders.ts",

        name:
            "createOrder",

        kind:
            "function"
    }
];


const joined =
    joinDependencies(
        resolverResult,
        callerIndex,
        declarations
    );


/*
 * ------------------------------------------------------------
 * IMPORT EDGE
 * ------------------------------------------------------------
 */

assert.ok(
    joined.some(
        edge =>
            edge.from ===
                "consumer.ts" &&
            edge.to ===
                "source.ts::validate:function" &&
            edge.kind ===
                "import" &&
            edge.confidence ===
                "certain"
    ),
    "certain import edge must survive the join"
);


/*
 * ------------------------------------------------------------
 * CALL EDGE
 * ------------------------------------------------------------
 *
 * The bare callee name must be upgraded to its declaration
 * identity using the caller's file context.
 */

assert.ok(
    joined.some(
        edge =>
            edge.from ===
                "auth.ts::loadSession:function" &&

            edge.to ===
                "auth.ts::verifyToken:function" &&

            edge.kind ===
                "call" &&

            edge.confidence ===
                "inferred"
    ),
    "caller edge must resolve to declaration identity"
);


/*
 * Bare names must not survive in canonical call edges.
 */

assert.equal(
    joined.some(
        edge =>
            edge.kind ===
                "call" &&

            edge.to ===
                "verifyToken"
    ),
    false,
    "bare caller names must not survive the join"
);


/*
 * ------------------------------------------------------------
 * NO FABRICATED DECLARATION IMPORT EDGE
 * ------------------------------------------------------------
 */

assert.equal(
    joined.some(
        edge =>
            edge.from ===
                "auth.ts::loadSession:function" &&

            edge.to ===
                "source.ts::validate:function"
    ),
    false,
    "join must not fabricate declaration-level import edges"
);


/*
 * ------------------------------------------------------------
 * DECLARATION FILE INDEX
 * ------------------------------------------------------------
 */

const fileIndex =
    buildDeclarationFileIndex(
        declarations
    );


assert.deepEqual(
    fileIndex,
    {
        "auth.ts": [
            "auth.ts::loadSession:function",
            "auth.ts::verifyToken:function"
        ],

        "orders.ts": [
            "orders.ts::createOrder:function"
        ]
    }
);


/*
 * ------------------------------------------------------------
 * DETERMINISM
 * ------------------------------------------------------------
 */

assert.deepEqual(
    joinDependencies(
        resolverResult,
        callerIndex,
        declarations
    ),

    joinDependencies(
        resolverResult,
        callerIndex,
        declarations
    )
);


console.log(
    "PASS: dependency join regression"
);
