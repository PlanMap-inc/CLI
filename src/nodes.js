// DECLARATION TYPES
// 1-Defines the Tree-sitter node types that are treated as declarations.
// 2-Stores all supported declaration types inside a Set.
// 3-Declaration types currently recognized
//     Class declarations
//     Function declarations
//     Generator function declarations
//     Method definitions
//     Variable declarators
//     Object property pairs
//     Field definitions
//     Assignment expressions
// --------------------------------------------------
const DECLARATION_TYPES = new Set([
    "class_declaration",
    "function_declaration",
    "generator_function_declaration",
    "method_definition",
    "variable_declarator",
    "pair",
    "field_definition",
    "assignment_expression"]);

// --------------------------------------------------
// CHECK DECLARATION NODE
// --------------------------------------------------
// 1-Receives a Tree-sitter syntax tree node.
// 2-Gets the type of the provided node.
// 3-Checks whether the node type exists in DECLARATION_TYPES.
// 4-Returns true if the node type is a supported declaration.
// 5-Returns false if the node type is not a supported declaration.
// 6-This function is used to identify which nodes should be treated as declarations.
// --------------------------------------------------
export function isDeclarationNode(node) {
    return DECLARATION_TYPES.has(
        node.type
    );
}

// --------------------------------------------------
// GET EXPRESSION TEXT
// --------------------------------------------------
// 1-Receives a Tree-sitter syntax tree node.
// 2-Checks whether the node exists.
// 3-If the node does not exist, returns null.
// 4-Checks whether the node is an identifier or property identifier.
// 5-If it is an identifier, returns its text.
// 6-Checks whether the node is a member expression.
// 7-If it is a member expression, gets the object part.
// 8-Gets the property part of the member expression.
// 9-Recursively gets the text of the object.
// 10-Checks whether both the object text and property exist.
// 11-Combines the object and property using dot notation.
// 12-Returns the complete expression text.
// 13-Returns null if the expression type is not supported.
// --------------------------------------------------
export function getExpressionText(node) {
    if (!node) {
        return null;
    }
    if ( node.type === "identifier" || node.type === "property_identifier" ) {
        return node.text;
    }
    if ( node.type === "member_expression") {
        const object = node.childForFieldName("object");
        const property =node.childForFieldName("property");
        const objectText =getExpressionText(object);

        if ( objectText && property) {
            return `${objectText}.${property.text}`;
        }
    }
    return null;
}
