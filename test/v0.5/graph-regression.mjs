import assert from "node:assert/strict";

import {
    joinDependencies
} from "../../src/dependencies/join.js";

import {
    buildGraph
} from "../../src/dependencies/graph.js";


const declarations = [
    {
        identity:
            "auth.ts::verifyToken:function",

        kind:
            "function",

        name:
            "verifyToken",

        file:
            "auth.ts"
    },

    {
        identity:
            "auth.ts::loadSession:function",

        kind:
            "function",

        name:
            "loadSession",

        file:
            "auth.ts"
    },

    {
        identity:
            "orders.ts::createOrder:function",

        kind:
            "function",

        name:
            "createOrder",

        file:
            "orders.ts"
    },

    {
        identity:
            "orders.ts::handleOrder:function",

        kind:
            "function",

        name:
            "handleOrder",

        file:
            "orders.ts"
    }
];


const callerIndex = {
    verifyToken: [
        {
            caller:
                "auth.ts::loadSession:function",

            confidence:
                "inferred"
        }
    ],

    loadSession: [
        {
            caller:
                "orders.ts::createOrder:function",

            confidence:
                "inferred"
        }
    ],

    createOrder: [
        {
            caller:
                "orders.ts::handleOrder:function",

            confidence:
                "inferred"
        }
    ]
};


const dependencyEdges = [
    {
        from:
            "orders.ts::createOrder:function",

        to:
            "auth.ts::loadSession:function",

        kind:
            "import",

        confidence:
            "certain"
    }
];


const joinedEdges =
    joinDependencies(
        {
            edges:
                dependencyEdges
        },
        callerIndex,
        declarations
    );

const graph =
    buildGraph({
        declarations,
        dependencyEdges:
            joinedEdges
    });


/*
 * ------------------------------------------------------------
 * NODE CONTRACT
 * ------------------------------------------------------------
 */

assert.equal(
    graph.nodes.length,
    4
);

assert.deepEqual(
    graph.nodes.map(
        node =>
            node.id
    ),
    [
        "auth.ts::loadSession:function",
        "auth.ts::verifyToken:function",
        "orders.ts::createOrder:function",
        "orders.ts::handleOrder:function"
    ]
);


/*
 * ------------------------------------------------------------
 * EDGE CONTRACT
 * ------------------------------------------------------------
 */

assert.equal(
    graph.edges.length,
    4
);


/*
 * Call relationships
 */

assert.ok(
    graph.edges.some(
        edge =>
            edge.from ===
                "auth.ts::loadSession:function" &&
            edge.to ===
                "auth.ts::verifyToken:function" &&
            edge.kind ===
                "call"
    )
);


/*
 * Certain dependency relationship
 */

assert.ok(
    graph.edges.some(
        edge =>
            edge.from ===
                "orders.ts::createOrder:function" &&
            edge.to ===
                "auth.ts::loadSession:function" &&
            edge.kind ===
                "import" &&
            edge.confidence ===
                "certain"
    )
);


/*
 * ------------------------------------------------------------
 * DETERMINISM
 * ------------------------------------------------------------
 */

const joinedEdgesAgain =
    joinDependencies(
        {
            edges:
                dependencyEdges
        },
        callerIndex,
        declarations
    );

const graphAgain =
    buildGraph({
        declarations,
        dependencyEdges:
            joinedEdgesAgain
    });


assert.deepEqual(
    graphAgain,
    graph
);



/*
 * ------------------------------------------------------------
 * UNRESOLVED EDGES
 * ------------------------------------------------------------
 */

const unresolvedGraph =
    buildGraph({
        declarations,

        dependencyEdges: [
            {
                from:
                    "consumer.ts",

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
    });

const unresolvedEdge =
    unresolvedGraph.edges.find(
        edge =>
            edge.from ===
                "consumer.ts"
    );

assert.ok(
    unresolvedEdge,
    "unresolved dependency edge must remain visible"
);

assert.equal(
    unresolvedEdge.to,
    null
);

assert.equal(
    unresolvedEdge.kind,
    "import"
);

assert.equal(
    unresolvedEdge.confidence,
    "unresolved"
);

assert.equal(
    unresolvedEdge.reason,
    "module-not-found"
);


console.log(
    "PASS: graph regression"
);

console.log(
    JSON.stringify(
        graph,
        null,
        2
    )
);
