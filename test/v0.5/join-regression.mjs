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


const joined =
    joinDependencies(
        resolverResult,
        callerIndex
    );


/*
 * IMPORT EDGE
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
 * CALL EDGE
 */

assert.ok(
    joined.some(
        edge =>
            edge.from ===
                "auth.ts::loadSession:function" &&
            edge.to ===
                "verifyToken" &&
            edge.kind ===
                "call" &&
            edge.confidence ===
                "inferred"
    ),
    "inferred caller edge must survive the join"
);


/*
 * NO FABRICATED DECLARATION EDGE
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
 * DECLARATION FILE INDEX
 */

const declarations = [
    {
        identity:
            "auth.ts::loadSession:function",

        file:
            "auth.ts"
    },

    {
        identity:
            "auth.ts::verifyToken:function",

        file:
            "auth.ts"
    },

    {
        identity:
            "orders.ts::createOrder:function",

        file:
            "orders.ts"
    }
];


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
 * DETERMINISM
 */

assert.deepEqual(
    joinDependencies(
        resolverResult,
        callerIndex
    ),
    joinDependencies(
        resolverResult,
        callerIndex
    )
);


console.log(
    "PASS: dependency join regression"
);
