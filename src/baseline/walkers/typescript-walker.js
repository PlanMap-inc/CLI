import { walkDeclarations } from "./core.js";


// --------------------------------------------------
// TYPESCRIPT / TSX DECLARATION WALKER
// --------------------------------------------------
// TypeScript-specific node-type table. Shared traversal,
// naming and nesting rules live in ./core.js.
//
// TypeScript-only nodes handled here:
//   abstract_class_declaration  abstract classes
//   internal_module             namespace / module blocks
//   public_field_definition     class fields (the TS and
//                               TSX grammars use this
//                               instead of JavaScript's
//                               field_definition)
// --------------------------------------------------

const HOOKS = {
    classNodeTypes: new Set([
        "class_declaration",
        "abstract_class_declaration"
    ]),

    fieldNodeTypes: new Set([
        "public_field_definition"
    ]),

    handleNamespaceNode(node, scope) {
        if (node.type !== "internal_module") {
            return null;
        }

        const nameNode =
            node.childForFieldName("name");

        if (
            nameNode &&
            nameNode.type !== "string"
        ) {
            return [...scope, nameNode.text];
        }

        return null;
    }
};


export function extractTypeScriptDeclarations(
    rootNode
) {
    return walkDeclarations(
        rootNode,
        HOOKS
    );
}
