import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    resolveRelativeModule
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


const importer =
    path.join(
        fixtureRoot,
        "fileC.ts"
    );


const resolved =
    resolveRelativeModule(
        importer,
        "./fileA.js"
    );


assert.equal(
    resolved.confidence,
    "certain"
);

assert.equal(
    path.basename(
        resolved.path
    ),
    "fileA.ts"
);


const unresolved =
    resolveRelativeModule(
        importer,
        "./does-not-exist.js"
    );


assert.equal(
    unresolved.path,
    null
);

assert.equal(
    unresolved.confidence,
    "unresolved"
);


const external =
    resolveRelativeModule(
        importer,
        "some-package"
    );


assert.equal(
    external.path,
    null
);

assert.equal(
    external.confidence,
    "unresolved"
);


console.log(
    "PASS: resolver boundary contracts"
);
