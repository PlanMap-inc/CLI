import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanProject } from "../../src/scanner.js";
import {
    buildCallerIndex,
    findCallers
} from "../../src/dependencies/callers.js";


const __filename =
    fileURLToPath(
        import.meta.url
    );

const __dirname =
    path.dirname(
        __filename
    );

const projectRoot =
    path.resolve(
        __dirname,
        "deps",
        "callers"
    );


const declarations =
    scanProject(
        projectRoot
    );


const callerIndex =
    buildCallerIndex(
        declarations
);


// ------------------------------------------------------------
// BASIC INDEX
// ------------------------------------------------------------

assert.ok(
    callerIndex.verifyToken,
    "verifyToken must have callers"
);

assert.ok(
    callerIndex.loadSession,
    "loadSession must have callers"
);

assert.ok(
    callerIndex.createOrder,
    "createOrder must have callers"
);


// ------------------------------------------------------------
// DIRECT CALLER
// ------------------------------------------------------------

assert.deepEqual(
    callerIndex.verifyToken,
    [
        {
            caller:
                "auth.ts::loadSession:function",

            confidence:
                "inferred"
        }
    ]
);


// ------------------------------------------------------------
// SECOND LEVEL
// ------------------------------------------------------------

assert.deepEqual(
    callerIndex.loadSession,
    [
        {
            caller:
                "orders.ts::createOrder:function",

            confidence:
                "inferred"
        }
    ]
);


// ------------------------------------------------------------
// THIRD LEVEL
// ------------------------------------------------------------

assert.deepEqual(
    callerIndex.createOrder,
    [
        {
            caller:
                "orders.ts::handleOrder:function",

            confidence:
                "inferred"
        }
    ]
);


// ------------------------------------------------------------
// DEPTH 1
// ------------------------------------------------------------

const depthOne =
    findCallers(
        callerIndex,
        "verifyToken",
        1
    );

assert.deepEqual(
    depthOne,
    [
        {
            identity:
                "auth.ts::loadSession:function",

            depth:
                1,

            confidence:
                "inferred"
        }
    ]
);


// ------------------------------------------------------------
// DEPTH 2
// ------------------------------------------------------------

const depthTwo =
    findCallers(
        callerIndex,
        "verifyToken",
        2
    );

assert.deepEqual(
    depthTwo,
    [
        {
            identity:
                "auth.ts::loadSession:function",

            depth:
                1,

            confidence:
                "inferred"
        },
        {
            identity:
                "orders.ts::createOrder:function",

            depth:
                2,

            confidence:
                "inferred"
        }
    ]
);


// ------------------------------------------------------------
// DEPTH 3
// ------------------------------------------------------------

const depthThree =
    findCallers(
        callerIndex,
        "verifyToken",
        3
    );

assert.deepEqual(
    depthThree,
    [
        {
            identity:
                "auth.ts::loadSession:function",

            depth:
                1,

            confidence:
                "inferred"
        },
        {
            identity:
                "orders.ts::createOrder:function",

            depth:
                2,

            confidence:
                "inferred"
        },
        {
            identity:
                "orders.ts::handleOrder:function",

            depth:
                3,

            confidence:
                "inferred"
        }
    ]
);


console.log(
    "PASS: caller index regression"
);

console.log(
    JSON.stringify(
        {
            callerIndex,
            depthOne,
            depthTwo,
            depthThree
        },
        null,
        2
    )
);
