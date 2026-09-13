import { walkDeclarations } from "./core.js";


// --------------------------------------------------
// JAVASCRIPT DECLARATION WALKER
// --------------------------------------------------
// JavaScript-specific node-type table. Shared traversal,
// naming and nesting rules live in ./core.js.
// --------------------------------------------------

const HOOKS = {
    classNodeTypes: new Set([
        "class_declaration"
    ]),

    fieldNodeTypes: new Set([
        "field_definition"
    ]),

    handleNamespaceNode() {
        return null;
    }
};


export function extractJavaScriptDeclarations(
    rootNode
) {
    return walkDeclarations(
        rootNode,
        HOOKS
    );
}
