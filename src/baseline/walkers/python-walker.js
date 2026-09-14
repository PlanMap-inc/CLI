import { createDeclaration } from "../declarations/model.js";
import { extractPythonProperties } from "../python-properties.js";


// --------------------------------------------------
// PYTHON DECLARATION WALKER
// --------------------------------------------------
// Standalone traversal for Python's Tree-sitter grammar.
// Shares no code with core.js - Python's node types
// (function_definition, class_definition, decorated_definition)
// do not exist in the JS/TS grammars core.js is built for.
// --------------------------------------------------


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
// PROCESS ONE DECLARATION
// --------------------------------------------------
// Handles both function_definition and class_definition.
// After pushing the declaration, recurses into the
// definition's own body only (never back through its
// decorated_definition wrapper's siblings) - this is what
// prevents a decorated definition from being visited twice.
// --------------------------------------------------

function processDefinitionNode(
    definitionNode,
    scope,
    declarations
) {

    const nameNode = definitionNode.childForFieldName("name");
    const name = nameNode ? nameNode.text : "<anonymous>";
    const qualifiedName = [...scope, name].join(".");

    if (definitionNode.type === "class_definition") {

        declarations.push(
            createDeclaration(
                definitionNode,
                qualifiedName,
                "class",
                [],
                extractPythonProperties
            )
        );

    } else {

        const kind =
            isMethodContext(definitionNode)
                ? "method"
                : "function";

        declarations.push(
            createDeclaration(
                definitionNode,
                qualifiedName,
                kind,
                [],
                extractPythonProperties
            )
        );
    }

    const newScope = [...scope, name];

    const bodyNode = definitionNode.childForFieldName("body");

    if (bodyNode) {
        for (const child of bodyNode.namedChildren) {
            visitNode(child, newScope, declarations);
        }
    }
}


// --------------------------------------------------
// VISIT NODE
// --------------------------------------------------
// Walks every node in the tree, at every nesting depth
// (inside if/try/with blocks too, not just module/class/
// function bodies) so a conditionally-defined function is
// still found. decorated_definition and bare function/class
// definitions terminate the generic recursion at this node
// (via early return) and instead recurse explicitly into the
// definition's own body with an updated scope - this is what
// prevents double-counting a decorated definition.
// --------------------------------------------------

function visitNode(node, scope, declarations) {

    if (!node) {
        return;
    }

    if (node.type === "decorated_definition") {
        const inner = node.childForFieldName("definition");

        if (inner) {
            processDefinitionNode(inner, scope, declarations);
        }

        return;
    }

    if (
        node.type === "function_definition" ||
        node.type === "class_definition"
    ) {
        processDefinitionNode(node, scope, declarations);
        return;
    }

    for (const child of node.namedChildren) {
        visitNode(child, scope, declarations);
    }
}


export function extractPythonDeclarations(rootNode) {
    const declarations = [];
    visitNode(rootNode, [], declarations);
    return declarations;
}