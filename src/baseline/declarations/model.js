import { extractProperties } from "../properties.js";


// --------------------------------------------------
// COMMON PLANMAP DECLARATION
// --------------------------------------------------
// Every language walker emits this one representation.
// Identity format: name:kind[:static]
// --------------------------------------------------

export function createDeclaration(
    node,
    name,
    kind,
    modifiers = []
) {

    const identityParts = [
        name,
        kind
    ];


    if (modifiers.includes("static")) {
        identityParts.push("static");
    }


    return {
        type: node.type,
        kind,
        name,
        modifiers,
        identity: identityParts.join(":"),
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        startLine: node.startPosition.row + 1,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column,
        properties: extractProperties(node)
    };
}
