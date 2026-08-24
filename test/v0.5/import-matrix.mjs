import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    resolveProjectImports
} from "../../src/dependencies/resolver.js";

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const root =
    path.resolve(
        __dirname,
        "deps",
        "imports"
    );

function resolveFixture(name) {
    return resolveProjectImports(
        path.join(root, name)
    );
}

function edge(result, imported) {
    return result.edges.find(
        item =>
            item.imported === imported
    );
}


// ------------------------------------------------------------
// NAMED
// ------------------------------------------------------------

{
    const result =
        resolveFixture("named");

    const validate =
        edge(result, "validate");

    const parse =
        edge(result, "parse");

    assert.ok(validate);
    assert.ok(parse);

    assert.equal(
        validate.to,
        "source.ts::validate:function"
    );

    assert.equal(
        parse.to,
        "source.ts::parse:function"
    );

    assert.equal(
        validate.confidence,
        "certain"
    );

    assert.equal(
        parse.confidence,
        "certain"
    );
}


// ------------------------------------------------------------
// DEFAULT
// ------------------------------------------------------------

{
    const result =
        resolveFixture("default");

    const client =
        edge(result, "default");

    assert.ok(
        client,
        "default import edge must exist"
    );

    assert.equal(
        client.confidence,
        "certain"
    );
}


// ------------------------------------------------------------
// NAMESPACE
// ------------------------------------------------------------

{
    const result =
        resolveFixture("namespace");

    const namespace =
        result.edges.find(
            item =>
                item.kind ===
                "namespace"
        );

    assert.ok(
        namespace,
        "namespace import edge must exist"
    );

    assert.equal(
        namespace.confidence,
        "certain"
    );
}


// ------------------------------------------------------------
// COMMONJS
// ------------------------------------------------------------

{
    const result =
        resolveFixture("cjs");

    assert.ok(
        result.edges.length > 0,
        "CommonJS require edge must exist"
    );
}


// ------------------------------------------------------------
// COMMONJS DESTRUCTURED
// ------------------------------------------------------------

{
    const result =
        resolveFixture(
            "cjs-destructured"
        );

    assert.ok(
        result.edges.length > 0,
        "destructured require edge must exist"
    );
}


// ------------------------------------------------------------
// RE-EXPORT
// ------------------------------------------------------------

{
    const result =
        resolveFixture("reexport");

    assert.ok(
        result.edges.length > 0,
        "re-export edge must exist"
    );
}


// ------------------------------------------------------------
// EXTERNAL
// ------------------------------------------------------------

{
    const result =
        resolveFixture("external");

    const external =
        result.edges[0];

    assert.ok(external);

    assert.equal(
        external.confidence,
        "unresolved"
    );
}


// ------------------------------------------------------------
// MISSING
// ------------------------------------------------------------

{
    const result =
        resolveFixture("missing");

    const missing =
        result.edges[0];

    assert.ok(missing);

    assert.equal(
        missing.confidence,
        "unresolved"
    );
}


console.log(
    "PASS: import matrix regression"
);
