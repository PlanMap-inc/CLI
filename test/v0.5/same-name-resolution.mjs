import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    resolveProjectImports
} from "../../src/dependencies/resolver.js";


const __filename =
    fileURLToPath(
        import.meta.url
    );

const __dirname =
    path.dirname(
        __filename
    );

const fixtureRoot =
    path.resolve(
        __dirname,
        "deps",
        "same-name"
    );


const result =
    resolveProjectImports(
        fixtureRoot
    );


const edge =
    result.edges.find(
        candidate =>
            candidate.imported ===
            "validate"
    );


assert.ok(
    edge,
    "expected validate import edge"
);


assert.equal(
    edge.confidence,
    "certain",
    "relative import should resolve with certain confidence"
);


assert.equal(
    path.basename(
        edge.targetFile
    ),
    "fileA.ts",
    "validate must resolve to fileA.ts"
);


assert.equal(
    edge.to,
    "fileA.ts::validate:function",
    "validate must resolve to fileA declaration"
);


assert.notEqual(
    edge.to,
    "fileB.ts::validate:function",
    "resolver must never cross-link same-name declaration in fileB"
);


console.log(
    "PASS: same-name dependency resolution"
);

console.log(
    JSON.stringify(
        edge,
        null,
        2
    )
);
