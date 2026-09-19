import { walkTree } from "../walk.js";
import { createDeclaration } from "../declarations/model.js";
import { getExpressionText } from "../nodes.js";


// --------------------------------------------------
// SHARED DECLARATION WALKER
// --------------------------------------------------
// Owns Tree-sitter node recognition, naming and nesting
// rules common to JavaScript, TypeScript and TSX. The
// three points where the grammars actually differ (which
// node types count as a class, which count as a class
// field, and TypeScript's namespace/module blocks) are
// supplied by the caller as `hooks` — see the two thin
// wrapper files in this directory for what each language
// passes in.
// --------------------------------------------------


// --------------------------------------------------
// SHARED NAMING
// --------------------------------------------------

function getDeclarationName(node) {

    const nameNode =
        node.childForFieldName("name");


    if (nameNode) {
        return nameNode.text;
    }


    return "<anonymous>";
}


function normalizeKey(node) {

    if (node.type === "string") {
        return node.text.slice(1, -1);
    }


    return node.text;
}


// --------------------------------------------------
// STABLE CALLBACK SCOPE
// --------------------------------------------------
// describe("label", () => { ... }) names the callback
// scope after the string label.
// --------------------------------------------------

function getNamedCallScope(node) {

    if (
        node.type !== "arrow_function" &&
        node.type !== "function_expression"
    ) {
        return null;
    }


    const args = node.parent;

    if (
        !args ||
        args.type !== "arguments"
    ) {
        return null;
    }


    const call = args.parent;

    if (
        !call ||
        call.type !== "call_expression"
    ) {
        return null;
    }


    const first =
        args.namedChildren[0];

    if (
        !first ||
        first.type !== "string"
    ) {
        return null;
    }


    const label =
        first.text.slice(1, -1).trim();

    if (!label) {
        return null;
    }


    return label;
}


// --------------------------------------------------
// SHARED NODE RULES
// --------------------------------------------------

function visitNode(
    node,
    scope,
    declarations,
    hooks
) {

    let currentScope = scope;


    // CLASS DECLARATION
    if (
        hooks.classNodeTypes.has(node.type)
    ) {
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

            currentScope = [...scope, name];
        }
    }


    // NAMESPACE / MODULE (language-specific; a no-op for
    // languages that don't have one)
    {
        const namespaceScope =
            hooks.handleNamespaceNode(node, scope);

        if (namespaceScope) {
            currentScope = namespaceScope;
        }
    }


    // VARIABLE DECLARATOR
    if (node.type === "variable_declarator") {
        const name = getDeclarationName(node);
        const value = node.childForFieldName("value");

        // const api = { ... }
        if (
            value?.type === "object" &&
            name !== "<anonymous>"
        ) {
            currentScope = [...scope, name];
        }

        // --------------------------------------------------
        // const sections = ["welcome", "first_question", ...]
        // --------------------------------------------------
        // A named list or table at the top of a module is a declaration in
        // every sense that matters here: it is named, it is depended on, and
        // changing it changes behaviour. Indexing only functions meant a
        // project's routes, its question order, its status codes and its
        // config were invisible - so a file made entirely of them reported
        // no declarations and no changes, however much it moved.
        //
        // Only at module scope: a list inside a function is that function's
        // business, and is already covered by its facts.
        if (
            (
                value?.type === "array" ||
                value?.type === "object"
            ) &&
            name !== "<anonymous>" &&
            scope.length === 0
        ) {
            declarations.push(
                createDeclaration(
                    node,
                    name,
                    "data"
                )
            );
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

            currentScope = [...scope, name];
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

            currentScope = [...scope, name];
        }
    }


    // NAMED CALLBACK SCOPE
    const namedCallScope =
        getNamedCallScope(node);

    if (namedCallScope) {
        currentScope = [...scope, namedCallScope];
    }


    // NORMAL / GENERATOR FUNCTION
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

            currentScope = [...scope, name];
        }
    }


    // NAMED FUNCTION EXPRESSION
    if (node.type === "function_expression") {
        const name = getDeclarationName(node);
        const parentType = node.parent?.type;

        const alreadyBound =
            parentType === "variable_declarator" ||
            parentType === "pair" ||
            hooks.fieldNodeTypes.has(parentType) ||
            parentType === "assignment_expression";

        if (
            name !== "<anonymous>" &&
            !alreadyBound
        ) {
            currentScope = [...scope, name];
        }
    }


    // METHOD
    if (node.type === "method_definition") {
        const nameNode =
            node.childForFieldName("name");

        if (
            nameNode &&
            nameNode.type !== "computed_property_name"
        ) {
            const rawName = nameNode.text;

            const name =
                nameNode.type === "string"
                    ? rawName.slice(1, -1)
                    : rawName;

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

            const qualifiedName =
                [...scope, name].join(".");

            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    kind,
                    modifiers
                )
            );

            currentScope = [...scope, name];
        }
    }


    // OBJECT PROPERTY
    if (node.type === "pair") {
        const key =
            node.childForFieldName("key");

        const value =
            node.childForFieldName("value");

        if (
            key &&
            key.type !== "computed_property_name"
        ) {
            const normalizedKey =
                normalizeKey(key);

            // admin: { ... }
            if (value?.type === "object") {
                currentScope = [
                    ...scope,
                    normalizedKey
                ];
            }

            // handler: () => {}
            // handler: function () {}
            if (
                value &&
                (
                    value.type === "arrow_function" ||
                    value.type === "function_expression"
                )
            ) {
                const qualifiedName =
                    [...scope, normalizedKey].join(".");

                declarations.push(
                    createDeclaration(
                        node,
                        qualifiedName,
                        "function"
                    )
                );

                currentScope = [
                    ...scope,
                    normalizedKey
                ];
            }
        }
    }


    // CLASS FIELD
    if (hooks.fieldNodeTypes.has(node.type)) {
        const property =
            node.childForFieldName("property") ||
            node.childForFieldName("name");

        const value =
            node.childForFieldName("value");

        if (
            property &&
            property.type !== "computed_property_name" &&
            value &&
            (
                value.type === "arrow_function" ||
                value.type === "function_expression"
            )
        ) {
            const qualifiedName =
                [...scope, property.text].join(".");

            const childTypes =
                node.children.map(
                    child => child.type
                );

            const modifiers = [];

            if (childTypes.includes("static")) {
                modifiers.push("static");
            }

            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    "function",
                    modifiers
                )
            );

            currentScope = [
                ...scope,
                property.text
            ];
        }
    }


    // ASSIGNMENT
    if (node.type === "assignment_expression") {
        const left = node.childForFieldName("left");
        const right = node.childForFieldName("right");
        const leftName = getExpressionText(left);

        // module.exports.admin = { ... }
        if (
            leftName &&
            right?.type === "object"
        ) {
            currentScope = [...scope, leftName];
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
            const qualifiedName =
                [...scope, leftName].join(".");

            declarations.push(
                createDeclaration(
                    node,
                    qualifiedName,
                    "function"
                )
            );

            currentScope = [...scope, leftName];
        }
    }


    return currentScope;
}


// --------------------------------------------------
// EXTRACT
// --------------------------------------------------

export function walkDeclarations(
    rootNode,
    hooks
) {

    const declarations = [];


    walkTree(
        rootNode,
        (node, scope) =>
            visitNode(
                node,
                scope,
                declarations,
                hooks
            )
    );


    return declarations;
}
