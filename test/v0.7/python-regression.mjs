import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanProject } from "../../src/baseline/scanner.js";
import { resolveFileImports, resolveProjectImports } from "../../src/dependencies/resolver.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures", "python");

function byIdentitySuffix(declarations, suffix) {
    return declarations.find(d => d.identity.endsWith(suffix));
}


// ------------------------------------------------------------
// SCAN THE FLAT FIXTURES ONCE, REUSE ACROSS TESTS 1-13
// ------------------------------------------------------------
// scanProject returns the declarations array directly, not an
// object wrapping it - confirmed against the real function
// (src/baseline/scanner.js's scanProject ends with
// "return declarations;") before writing this test.
// ------------------------------------------------------------

const allFlat = scanProject(FIXTURES, { quiet: true });
const flatDeclarations = allFlat.filter(
    d => !d.file.includes("/")
);


// ------------------------------------------------------------
// TEST 1: module function
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "basic.py::top_level_function:function");
    assert.ok(decl, "test 1: module function identity not found");
    console.log("PASS: test 1 - module function");
}


// ------------------------------------------------------------
// TEST 2: class method
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "basic.py::Widget.render:method");
    assert.ok(decl, "test 2: class method identity not found");
    console.log("PASS: test 2 - class method");
}


// ------------------------------------------------------------
// TEST 3: __init__
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "basic.py::Widget.__init__:method");
    assert.ok(decl, "test 3: __init__ identity not found");
    console.log("PASS: test 3 - __init__");
}


// ------------------------------------------------------------
// TEST 4: nested function
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "nested.py::outer.inner:function");
    assert.ok(decl, "test 4: nested function identity not found");
    console.log("PASS: test 4 - nested function");
}


// ------------------------------------------------------------
// TEST 5: @property does not alter identity
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "decorated.py::Api.value:method");
    assert.ok(decl, "test 5: @property-decorated method identity not found");
    console.log("PASS: test 5 - @property identity unchanged");
}


// ------------------------------------------------------------
// TEST 6: @app.route("/x") does not alter identity
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "decorated.py::Api.route_handler:method");
    assert.ok(decl, "test 6: @app.route-decorated method identity not found");
    console.log("PASS: test 6 - @app.route(...) identity unchanged");
}


// ------------------------------------------------------------
// TEST 7: raise ValueError(...)
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "facts.py::raises_value_error:function");
    assert.ok(decl, "test 7: raises_value_error not found");
    assert.ok(decl.properties.throws >= 1, "test 7: throws should be >= 1");
    assert.ok(
        decl.properties.throwTypes.includes("ValueError"),
        "test 7: throwTypes should include ValueError"
    );
    console.log("PASS: test 7 - raise ValueError(...)");
}


// ------------------------------------------------------------
// TEST 8: except Exception: pass
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "facts.py::catches_broad_exception:function");
    assert.ok(decl, "test 8: catches_broad_exception not found");
    assert.ok(decl.properties.emptyCatches >= 1, "test 8: emptyCatches should be >= 1");
    console.log("PASS: test 8 - except Exception: pass");
}


// ------------------------------------------------------------
// TEST 9: async def with await
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "facts.py::waits_and_returns_none:function");
    assert.ok(decl, "test 9: waits_and_returns_none not found");
    assert.ok(decl.properties.awaits >= 1, "test 9: awaits should be >= 1");
    console.log("PASS: test 9 - async def with await");
}


// ------------------------------------------------------------
// TEST 10: return None
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "facts.py::waits_and_returns_none:function");
    assert.ok(decl.properties.returnsNullish >= 1, "test 10: returnsNullish should be >= 1");
    console.log("PASS: test 10 - return None");
}


// ------------------------------------------------------------
// TEST 11: def m(self, a, b) -> params == 2
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "selfparams.py::Calculator.add:method");
    assert.ok(decl, "test 11: Calculator.add not found");
    assert.equal(decl.properties.params, 2, "test 11: params should be 2, not 3");
    console.log("PASS: test 11 - self excluded from params");
}


// ------------------------------------------------------------
// TEST 12: def m(cls, a) -> params == 1
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "selfparams.py::Calculator.create:method");
    assert.ok(decl, "test 12: Calculator.create not found");
    assert.equal(decl.properties.params, 1, "test 12: params should be 1, not 2");
    console.log("PASS: test 12 - cls excluded from params");
}


// ------------------------------------------------------------
// TEST 13: same method name, two classes -> distinct identities
// ------------------------------------------------------------
{
    const aBoot = byIdentitySuffix(flatDeclarations, "collisions.py::A.boot:method");
    const bBoot = byIdentitySuffix(flatDeclarations, "collisions.py::B.boot:method");
    assert.ok(aBoot, "test 13: A.boot not found");
    assert.ok(bBoot, "test 13: B.boot not found");
    assert.notEqual(aBoot.identity, bBoot.identity, "test 13: identities must be distinct");
    console.log("PASS: test 13 - same method name, two classes, distinct identities");
}


// ------------------------------------------------------------
// TEST 14-16: import resolution
// ------------------------------------------------------------
{
    const importProjectRoot = path.join(FIXTURES, "importtest");
    const result = resolveFileImports(
        importProjectRoot,
        path.join(importProjectRoot, "consumer.py")
    );

    const sibling = result.edges.find(e => e.imported === "sibling");
    assert.ok(sibling, "test 14: 'from . import sibling' edge not found");
    assert.equal(sibling.confidence, "certain", "test 14: expected certain confidence");
    console.log("PASS: test 14 - from . import x resolves certain");

    const requestsImport = result.edges.find(e => e.source === "requests" || e.local === "requests");
    assert.ok(requestsImport, "test 15: 'import requests' edge not found");
    assert.equal(requestsImport.confidence, "unresolved", "test 15: expected unresolved confidence");
    assert.ok(
        requestsImport.reason.includes("external") || requestsImport.reason.includes("stdlib"),
        "test 15: reason should name it as external"
    );
    console.log("PASS: test 15 - import requests is unresolved, reason names it external");

    const missingImport = result.edges.find(e => e.imported === "x");
    assert.ok(missingImport, "test 16: 'from .missing import x' edge not found");
    assert.equal(missingImport.confidence, "unresolved", "test 16: expected unresolved confidence");
    assert.ok(missingImport.reason, "test 16: reason should be present");
    console.log("PASS: test 16 - from .missing import x is unresolved with an explicit reason");
}


// ------------------------------------------------------------
// TEST 17: unparseable .py file is skipped, scan continues
// ------------------------------------------------------------
{
    const projectRoot = path.join(FIXTURES, "brokenproject");
    const warningState = { skipped: [], disambiguated: 0 };

    const result = scanProject(
        projectRoot,
        { quiet: true, warningState }
    );

    assert.ok(
        warningState.skipped.some(s => s.file === "broken.py"),
        "test 17: broken.py should be recorded as skipped"
    );

    const validDecl = result.find(
        d => d.identity.endsWith("valid.py::still_found:function")
    );

    assert.ok(validDecl, "test 17: valid.py's declaration should still be found - scan must continue");
    console.log("PASS: test 17 - unparseable file skipped, scan continues");
}


// ------------------------------------------------------------
// TEST 18: mixed JS + Python project, no cross-contamination
// ------------------------------------------------------------
{
    const projectRoot = path.join(FIXTURES, "mixedproject");
    const result = scanProject(projectRoot, { quiet: true });

    const jsDecl = result.find(
        d => d.identity === "script.js::process:function"
    );

    const pyDecl = result.find(
        d => d.identity === "script.py::process:function"
    );

    assert.ok(jsDecl, "test 18: script.js's process function not found");
    assert.ok(pyDecl, "test 18: script.py's process function not found");
    assert.notEqual(jsDecl.identity, pyDecl.identity, "test 18: JS and Python declarations must not share an identity");
    assert.equal(result.length, 2, "test 18: expected exactly 2 declarations, no duplication or cross-contamination");
    console.log("PASS: test 18 - mixed JS/Python project, no cross-contamination");
}


// ------------------------------------------------------------
// TEST 19: resolveProjectImports actually discovers .py files
// ------------------------------------------------------------
// Tests 14-16 call resolveFileImports() directly on one known
// file, which never exercises resolveProjectImports()'s own
// directory walk - the thing that decides whether .py files
// are found by a project-wide scan at all. Without this test,
// reverting the one-line ".py" file-discovery widening in
// resolver.js would leave every other test passing while the
// project-wide dependency graph silently contained zero Python
// edges.
// ------------------------------------------------------------
{
    const projectRoot = path.join(FIXTURES, "importtest");
    const result = resolveProjectImports(projectRoot);

    const pythonEdge = result.edges.find(
        edge => edge.importer.endsWith(".py")
    );

    assert.ok(
        pythonEdge,
        "test 19: resolveProjectImports found no edges from any .py file - project-wide Python import discovery is broken"
    );

    console.log("PASS: test 19 - resolveProjectImports discovers .py files");
}


// ------------------------------------------------------------
// TEST 20: zero duplicate identities, zero disambiguation,
// across every flat fixture combined
// ------------------------------------------------------------
// This is the direct regression test for the walker's central
// anti-double-counting claim (a decorated definition must not
// be counted once via the generic recursion and again via
// processDefinitionNode). Tests 5 and 6 only assert a decorated
// declaration exists, which would still pass if it were also
// double-counted as both :method and :function. This test
// would not.
// ------------------------------------------------------------
{
    const warningState = { skipped: [], disambiguated: 0 };

    scanProject(FIXTURES, { quiet: true, warningState });

    assert.equal(
        warningState.disambiguated,
        0,
        "test 20: no identity should need disambiguation - a collision means something (e.g. a decorated definition) was counted twice"
    );

    console.log("PASS: test 20 - zero duplicate identities across all fixtures");
}


// ------------------------------------------------------------
// TEST 21: positional-only "/" and keyword-only "*" separators
// are not counted as parameters
// ------------------------------------------------------------
// A second independent review (of the fix for a prior review's
// Critical finding) confirmed the fix works but noted neither
// it nor the conditional-method fix (test 22) had a dedicated
// fixture. This closes that gap directly, rather than relying
// only on the disambiguation-count sensor in test 20, which
// cannot detect either regression (params is not part of the
// identity string).
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "selfparams.py::Calculator.configure:method");
    assert.ok(decl, "test 21: Calculator.configure not found");
    assert.equal(
        decl.properties.params,
        3,
        "test 21: params should be 3 (self excluded, a/b/c counted, / and * separators not counted)"
    );
    console.log("PASS: test 21 - positional-only/keyword-only separators excluded from params");
}


// ------------------------------------------------------------
// TEST 22: a method defined inside "if" at class-body level is
// still classified as a method, with self excluded
// ------------------------------------------------------------
{
    const decl = byIdentitySuffix(flatDeclarations, "selfparams.py::FeatureFlag.enabled_method:method");
    assert.ok(decl, "test 22: FeatureFlag.enabled_method not found, or misclassified as :function");
    assert.equal(
        decl.properties.params,
        1,
        "test 22: params should be 1 (self excluded even though the method is conditionally defined)"
    );
    console.log("PASS: test 22 - conditionally-defined method still classified as method, self excluded");
}


console.log("\nPASS: python regression (22/22)");