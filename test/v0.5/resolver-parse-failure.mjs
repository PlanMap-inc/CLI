import assert from "node:assert/strict";
import path from "node:path";

import {
    resolveProjectImports
} from "../../src/dependencies/resolver.js";


const root =
    path.resolve(
        "test/v0.5/deps/parse-failure"
    );


let result;

assert.doesNotThrow(
    () => {
        result =
            resolveProjectImports(
                root
            );
    },
    "resolver must survive an unparseable target file"
);


assert.ok(
    result,
    "resolver result must exist"
);


const edge =
    result.edges.find(
        item =>
            item.source ===
            "./broken.js"
    );


assert.ok(
    edge,
    "import edge must still be represented"
);


assert.equal(
    edge.confidence,
    "unresolved"
);


assert.equal(
    edge.reason,
    "target-parse-failed"
);


assert.equal(
    edge.to,
    null
);


assert.equal(
    edge.kind,
    "import"
);


console.log(
    "PASS: resolver parse failure regression"
);
