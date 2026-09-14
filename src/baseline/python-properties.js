// --------------------------------------------------
// PYTHON PROPERTY EXTRACTION
// --------------------------------------------------
// Standalone from src/baseline/properties.js (JS/TS-only).
// Python's grammar has no throw_statement, catch_clause,
// call_expression, await_expression, or number node - it has
// raise_statement, except_clause, call, await, and separate
// integer/float nodes. This mirrors the JS/TS fact shape
// exactly, built against Python's own node types.
// --------------------------------------------------


function isNestedDeclaration(node) {

    if (node.type === "decorated_definition") {
        const inner = node.childForFieldName("definition");

        return (
            inner?.type === "function_definition" ||
            inner?.type === "class_definition"
        );
    }

    return (
        node.type === "function_definition" ||
        node.type === "class_definition"
    );
}


// --------------------------------------------------
// GET THROW TYPE
// --------------------------------------------------
// raise_statement has no named fields for its expression -
// confirmed directly against the grammar. Its first namedChild
// is the raised expression: a bare identifier ("raise Foo"),
// a call ("raise Foo(...)"), or absent entirely (bare "raise").
// A second child ("raise Foo() from cause") is the cause and
// is intentionally ignored here.
// --------------------------------------------------

function getThrowType(raiseNode) {

    const first = raiseNode.namedChildren[0];

    if (!first) {
        return null;
    }

    if (first.type === "call") {
        const fn = first.childForFieldName("function");
        return fn ? fn.text : null;
    }

    if (first.type === "identifier" || first.type === "attribute") {
        return first.text;
    }

    return null;
}


// --------------------------------------------------
// NULLISH RETURN
// --------------------------------------------------

function isNullishReturn(node) {
    const argument = node.namedChildren[0];
    return argument?.type === "none";
}


// --------------------------------------------------
// EMPTY EXCEPT
// --------------------------------------------------
// except_clause has no "body" field (confirmed directly - it
// only exposes a "value" field for the exception expression).
// Its body block is always present among namedChildren, typed
// "block". A body of exactly one pass_statement is what the
// task defines as empty - Python requires at least one
// statement in any block, so a truly empty except is not a
// thing; "except: pass" is the idiomatic equivalent and is
// deliberately still counted as empty.
// --------------------------------------------------

function findBlockChild(node) {
    return node.namedChildren.find(child => child.type === "block") ?? null;
}

function isEmptyExcept(exceptNode) {

    const body = findBlockChild(exceptNode);

    if (!body) {
        return false;
    }

    const executableChildren = body.namedChildren.filter(
        child => child.type !== "comment"
    );

    return (
        executableChildren.length === 1 &&
        executableChildren[0].type === "pass_statement"
    );
}


// --------------------------------------------------
// METHOD CONTEXT
// --------------------------------------------------
// A function_definition is a method if the nearest enclosing
// definition (walking up past decorated_definition wrappers
// and any if/try/with/else blocks a conditionally-defined
// method sits inside) is a class_definition. Walking up to the
// nearest enclosing definition - rather than checking exactly
// one "block" level - is what correctly handles a method
// defined inside "if TYPE_CHECKING:" or similar at class body
// level, which a single-level check misses.
// --------------------------------------------------

function isMethodContext(definitionNode) {

    let node = definitionNode.parent;

    while (node) {

        if (node.type === "class_definition") {
            return true;
        }

        if (
            node.type === "function_definition" ||
            node.type === "module"
        ) {
            return false;
        }

        node = node.parent;
    }

    return false;
}


// --------------------------------------------------
// PARAMETER COUNT
// --------------------------------------------------
// self/cls is excluded ONLY when this is a real method - a
// standalone function whose first parameter happens to be
// named self or cls (unusual, but legal Python) must not have
// it excluded. Verified against both cases directly.
//
// positional_separator ("/") and keyword_separator ("*") are
// named children of "parameters" but are not parameters
// themselves - they mark positional-only/keyword-only
// boundaries (def f(a, /, b, *, c)). Left uncounted, a single
// bare "*" before keyword-only args silently inflates every
// keyword-only function's params by one - a real, common
// modern-Python pattern, not an edge case.
// --------------------------------------------------

const PARAMETER_SEPARATOR_TYPES = new Set([
    "positional_separator",
    "keyword_separator"
]);

function getParameterCount(functionNode) {

    const parametersNode = functionNode.childForFieldName("parameters");

    if (!parametersNode) {
        return 0;
    }

    const params = parametersNode.namedChildren.filter(
        node => !PARAMETER_SEPARATOR_TYPES.has(node.type)
    );

    if (params.length === 0) {
        return 0;
    }

    const first = params[0];

    const isSelfOrCls =
        first.type === "identifier" &&
        (first.text === "self" || first.text === "cls") &&
        isMethodContext(functionNode);

    return isSelfOrCls ? params.length - 1 : params.length;
}


// --------------------------------------------------
// PROPERTY EXTRACTION
// --------------------------------------------------

export function extractPythonProperties(declarationNode) {

    const properties = {
        throws: 0,
        throwTypes: [],
        returns: 0,
        returnsNullish: 0,
        calls: [],
        numbers: [],
        awaits: 0,
        catches: 0,
        emptyCatches: 0,
        params: getParameterCount(declarationNode)
    };

    function visit(node, isRoot = false) {

        if (!node) {
            return;
        }

        if (!isRoot && isNestedDeclaration(node)) {
            return;
        }

        if (node.type === "raise_statement") {
            properties.throws++;

            const throwType = getThrowType(node);

            if (throwType) {
                properties.throwTypes.push(throwType);
            }
        }

        if (node.type === "return_statement") {
            properties.returns++;

            if (isNullishReturn(node)) {
                properties.returnsNullish++;
            }
        }

        if (node.type === "call") {
            const fn = node.childForFieldName("function");

            if (fn) {
                properties.calls.push(fn.text);
            }
        }

        if (node.type === "integer" || node.type === "float") {
            const value = Number(node.text.replace(/_/g, ""));

            if (Number.isFinite(value)) {
                properties.numbers.push(value);
            }
        }

        if (node.type === "await") {
            properties.awaits++;
        }

        if (node.type === "except_clause") {
            properties.catches++;

            if (isEmptyExcept(node)) {
                properties.emptyCatches++;
            }
        }

        for (const child of node.namedChildren) {
            visit(child);
        }
    }

    visit(declarationNode, true);

    properties.throwTypes = [...new Set(properties.throwTypes)].sort();
    properties.calls = [...new Set(properties.calls)].sort();

    properties.numbers = [...new Set(properties.numbers)].sort(
        (a, b) => a - b
    );

    return properties;
}