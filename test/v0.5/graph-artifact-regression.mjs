import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
    writeGraphArtifact,
    readGraphArtifact
} from "../../src/dependencies/artifact.js";


const projectRoot =
    fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            "planmap-graph-"
        )
    );


const graph = {
    nodes: [
        {
            id:
                "auth.ts::loadSession:function",

            kind:
                "function",

            name:
                "loadSession",

            file:
                "auth.ts"
        },

        {
            id:
                "auth.ts::verifyToken:function",

            kind:
                "function",

            name:
                "verifyToken",

            file:
                "auth.ts"
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
        }
    ]
};


/*
 * ------------------------------------------------------------
 * WRITE
 * ------------------------------------------------------------
 */

const graphPath =
    writeGraphArtifact(
        projectRoot,
        graph
    );


assert.equal(
    graphPath,
    path.join(
        projectRoot,
        ".planmap",
        "graph.json"
    )
);


assert.equal(
    fs.existsSync(
        graphPath
    ),
    true,
    "graph.json must be written"
);


/*
 * ------------------------------------------------------------
 * READ
 * ------------------------------------------------------------
 */

const loaded =
    readGraphArtifact(
        projectRoot
    );


assert.deepEqual(
    loaded,
    graph,
    "written graph must round-trip exactly"
);


/*
 * ------------------------------------------------------------
 * DETERMINISM
 * ------------------------------------------------------------
 */

const first =
    fs.readFileSync(
        graphPath,
        "utf8"
    );


writeGraphArtifact(
    projectRoot,
    graph
);


const second =
    fs.readFileSync(
        graphPath,
        "utf8"
    );


assert.equal(
    first,
    second,
    "graph artifact must be byte-deterministic"
);


/*
 * ------------------------------------------------------------
 * DELETE + REGENERATE
 * ------------------------------------------------------------
 */

fs.rmSync(
    path.join(
        projectRoot,
        ".planmap"
    ),
    {
        recursive:
            true,

        force:
            true
    }
);


assert.equal(
    fs.existsSync(
        graphPath
    ),
    false,
    "graph artifact must be safely deletable"
);


writeGraphArtifact(
    projectRoot,
    graph
);


assert.equal(
    fs.existsSync(
        graphPath
    ),
    true,
    "graph artifact must be regenerable"
);


console.log(
    "PASS: graph artifact regression"
);
