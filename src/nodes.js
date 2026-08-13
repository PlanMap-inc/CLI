// src/nodes.js

const DECLARATION_TYPES = new Set([
    "class_declaration",
    "function_declaration",
    "generator_function_declaration",
    "method_definition",
    "variable_declarator",
    "pair",
    "field_definition",
    "assignment_expression"
]);


export function isDeclarationNode(node) {

    return DECLARATION_TYPES.has(
        node.type
    );
}


export function getExpressionText(node) {

    if (!node) {
        return null;
    }


    if (
        node.type === "identifier" ||
        node.type === "property_identifier"
    ) {

        return node.text;
    }


    if (
        node.type === "member_expression"
    ) {

        const object =
            node.childForFieldName(
                "object"
            );

        const property =
            node.childForFieldName(
                "property"
            );


        const objectText =
            getExpressionText(
                object
            );


        if (
            objectText &&
            property
        ) {

            return `${objectText}.${property.text}`;
        }
    }


    return null;
}