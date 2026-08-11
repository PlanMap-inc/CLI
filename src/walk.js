
function getDeclarationName(node) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
        return nameNode.text;
    }
    return "<anonymous>";
}


function getExpressionText(node) {
    if (!node) {
        return null;
    }
    if (node.type === "identifier") {
        return node.text;
    }
    if (node.type === "member_expression") {
        const object = node.childForFieldName("object");
        const property = node.childForFieldName("property");
        const objectText = getExpressionText(object);
        if (objectText && property) {
            return `${objectText}.${property.text}`;
        }
    }
    return null;
}


function createDeclaration(
    node,
    name = getDeclarationName(node),
    kind = node.type,
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
        endColumn: node.endPosition.column
    };
}

// the walk function traverses the AST and collects declarations, returning an array of declaration objects. Each declaration object contains information about the type, kind, name, modifiers, and location of the declaration in the source code.
export function walk(node, scope = [], declarations = []) {

    let currentScope = scope;


    // --------------------------------------------------
    // CLASS DECLARATION
    // --------------------------------------------------

    if (node.type === "class_declaration") {

        const name = getDeclarationName(node);

        if (name !== "<anonymous>") {

            const qualifiedName =
                [...scope, name].join(".");

            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    "class"
                )
            );

            currentScope = [
                ...scope,
                name
            ];
        }
    }


    // --------------------------------------------------
    // VARIABLE DECLARATOR
    // --------------------------------------------------

    if (node.type === "variable_declarator") {

        const name = getDeclarationName(node);
        const value = node.childForFieldName("value");


        // const api = { ... }

        if (
            value?.type === "object" &&
            name !== "<anonymous>"
        ) {
            currentScope = [
                ...scope,
                name
            ];
        }


        // const MyClass = class { ... }

        if (
            value?.type === "class" &&
            name !== "<anonymous>"
        ) {

            const qualifiedName =
                [...scope, name].join(".");

            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    "class"
                )
            );

            currentScope = [
                ...scope,
                name
            ];
        }


        // const handler = () => {}
        // const handler = function () {}

        if (
            (
                value?.type === "arrow_function" ||
                value?.type === "function_expression"
            ) &&
            name !== "<anonymous>"
        ) {

            const qualifiedName =
                [...scope, name].join(".");

            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    "function"
                )
            );

            currentScope = [
                ...scope,
                name
            ];
        }
    }


    // --------------------------------------------------
    // NORMAL / GENERATOR FUNCTION
    // --------------------------------------------------

    if (
        node.type === "function_declaration" ||
        node.type === "generator_function_declaration"
    ) {

        const name = getDeclarationName(node);

        if (name !== "<anonymous>") {

            const qualifiedName =
                [...scope, name].join(".");

            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    "function"
                )
            );

            currentScope = [
                ...scope,
                name
            ];
        }
    }


    // --------------------------------------------------
    // NAMED FUNCTION EXPRESSION
    // --------------------------------------------------

    if (node.type === "function_expression") {

        const name = getDeclarationName(node);

        const parentType = node.parent?.type;

        const alreadyBound =
            parentType === "variable_declarator" ||
            parentType === "pair" ||
            parentType === "field_definition" ||
            parentType === "assignment_expression";

        if (
            name !== "<anonymous>" &&
            !alreadyBound
        ) {
            currentScope = [
                ...scope,
                name
            ];
        }
    }


    // --------------------------------------------------
    // METHOD
    // --------------------------------------------------

    if (node.type === "method_definition") {

        const nameNode =
            node.childForFieldName("name");

        if (
            nameNode &&
            nameNode.type !== "computed_property_name"
        ) {

            const name = nameNode.text;

            const childTypes =
                node.children.map(
                    child => child.type
                );


            const modifiers = [];


            if (childTypes.includes("static")) {
                modifiers.push("static");
            }

            if (childTypes.includes("async")) {
                modifiers.push("async");
            }

            if (childTypes.includes("*")) {
                modifiers.push("generator");
            }


            let kind = "method";

            if (childTypes.includes("get")) {
                kind = "getter";
            }
            else if (childTypes.includes("set")) {
                kind = "setter";
            }


            const qualifiedName = [
                ...scope,
                name
            ].join(".");


            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    kind,
                    modifiers
                )
            );


            currentScope = [
                ...scope,
                name
            ];
        }
    }


    // --------------------------------------------------
    // OBJECT PROPERTY
    // --------------------------------------------------

    if (node.type === "pair") {

        const key =
            node.childForFieldName("key");

        const value =
            node.childForFieldName("value");


        if (
            key &&
            key.type !== "computed_property_name"
        ) {

            // admin: { ... }

            if (value?.type === "object") {

                currentScope = [
                    ...scope,
                    key.text
                ];
            }


            // handler: () => {}

            if (
                value &&
                (
                    value.type === "arrow_function" ||
                    value.type === "function_expression"
                )
            ) {

                const qualifiedName = [
                    ...scope,
                    key.text
                ].join(".");


                declarations.push(
                    createDeclaration(
                        node,
                        qualifiedName,
                        "function"
                    )
                );


                currentScope = [
                    ...scope,
                    key.text
                ];
            }
        }
    }


    // --------------------------------------------------
    // CLASS FIELD
    // --------------------------------------------------

    if (node.type === "field_definition") {

        const property =
            node.childForFieldName("property");

        const value =
            node.childForFieldName("value");


        if (
            property &&
            property.type !== "computed_property_name"
        ) {

            if (
                value &&
                (
                    value.type === "arrow_function" ||
                    value.type === "function_expression"
                )
            ) {

                const qualifiedName = [
                    ...scope,
                    property.text
                ].join(".");


                declarations.push(
                    createDeclaration(
                        node,
                        qualifiedName,
                        "function"
                    )
                );


                currentScope = [
                    ...scope,
                    property.text
                ];
            }
        }
    }


    // --------------------------------------------------
    // ASSIGNMENT
    // --------------------------------------------------

    if (node.type === "assignment_expression") {

        const left =
            node.childForFieldName("left");

        const right =
            node.childForFieldName("right");

        const leftName =
            getExpressionText(left);


        // module.exports.admin = { ... }

        if (
            leftName &&
            right?.type === "object"
        ) {

            currentScope = [
                ...scope,
                leftName
            ];
        }


        // module.exports.handler = () => {}

        if (
            leftName &&
            right &&
            (
                right.type === "arrow_function" ||
                right.type === "function_expression"
            )
        ) {

            const qualifiedName = [
                ...scope,
                leftName
            ].join(".");


            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    "function"
                )
            );


            currentScope = [
                ...scope,
                leftName
            ];
        }
    }


    // --------------------------------------------------
    // WALK CHILDREN
    // --------------------------------------------------

    for (const child of node.namedChildren) {
        walk(
            child,
            currentScope,
            declarations
        );
    }

    return declarations;
}