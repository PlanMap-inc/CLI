// src/properties.js

import {
    getExpressionText
} from "./nodes.js";


// --------------------------------------------------
// NESTED DECLARATION CHECK
// --------------------------------------------------

function isNestedDeclaration(node) {

    switch (node.type) {

        case "class_declaration":
        case "function_declaration":
        case "generator_function_declaration":
        case "method_definition":
            return true;


        case "variable_declarator": {

            const value =
                node.childForFieldName("value");

            return (
                value?.type === "arrow_function" ||
                value?.type === "function_expression"
            );
        }


        case "pair": {

            const value =
                node.childForFieldName("value");

            return (
                value?.type === "arrow_function" ||
                value?.type === "function_expression"
            );
        }


        case "field_definition":
        case "public_field_definition": {

            const value =
                node.childForFieldName("value");

            return (
                value?.type === "arrow_function" ||
                value?.type === "function_expression"
            );
        }


        case "assignment_expression": {

            const right =
                node.childForFieldName("right");

            return (
                right?.type === "arrow_function" ||
                right?.type === "function_expression"
            );
        }


        default:
            return false;
    }
}


// --------------------------------------------------
// GET THROW TYPE
// --------------------------------------------------

function getThrowType(node) {

    const text =
        node.text.trim();


    const match =
        text.match(
            /\bnew\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/
        );


    if (match) {
        return match[1];
    }


    return null;
}


// --------------------------------------------------
// NULLISH RETURN
// --------------------------------------------------

function isNullishReturn(node) {

    const argument =
        node.childForFieldName(
            "argument"
        );


    if (argument) {

        if (
            argument.type === "null"
        ) {
            return true;
        }


        if (
            argument.type === "undefined"
        ) {
            return true;
        }


        if (
            argument.type === "identifier" &&
            argument.text === "undefined"
        ) {
            return true;
        }
    }


    const text =
        node.text
            .replace(/\s+/g, " ")
            .trim();


    return (
        text === "return null;" ||
        text === "return null" ||
        text === "return undefined;" ||
        text === "return undefined"
    );
}


// --------------------------------------------------
// EMPTY CATCH
// --------------------------------------------------

function isEmptyCatch(node) {

    const body =
        node.childForFieldName(
            "body"
        );


    if (body) {

        const executableChildren =
            body.namedChildren.filter(
                child =>
                    child.type !== "comment"
            );


        if (
            executableChildren.length === 0
        ) {
            return true;
        }
    }


    const text =
        node.text
            .replace(/\s+/g, " ")
            .trim();


    const open =
        text.lastIndexOf("{");


    const close =
        text.lastIndexOf("}");


    if (
        open !== -1 &&
        close !== -1 &&
        close > open
    ) {

        const inside =
            text
                .slice(
                    open + 1,
                    close
                )
                .trim();


        if (inside === "") {
            return true;
        }
    }


    return false;
}


// --------------------------------------------------
// RESOLVE FUNCTION NODE
// --------------------------------------------------

function getFunctionNode(
    declarationNode
) {

    switch (
        declarationNode.type
    ) {

        case "variable_declarator":
        case "pair":
        case "field_definition":
        case "public_field_definition":

            return (
                declarationNode.childForFieldName(
                    "value"
                ) ||
                declarationNode
            );


        case "assignment_expression":

            return (
                declarationNode.childForFieldName(
                    "right"
                ) ||
                declarationNode
            );


        default:

            return declarationNode;
    }
}


// --------------------------------------------------
// PARAMETER COUNT
// --------------------------------------------------

function getParameterCount(
    declarationNode
) {

    const functionNode =
        getFunctionNode(
            declarationNode
        );


    const parameters =
        functionNode?.childForFieldName(
            "parameters"
        );


    if (!parameters) {
        return 0;
    }


    return parameters.namedChildren.length;
}


// --------------------------------------------------
// PROPERTY EXTRACTION
// --------------------------------------------------

export function extractProperties(
    declarationNode
) {

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

        params:
            getParameterCount(
                declarationNode
            )
    };


    // ------------------------------------------------
    // WALK DECLARATION
    // ------------------------------------------------

    function visit(
        node,
        isRoot = false
    ) {

        if (!node) {
            return;
        }


        // --------------------------------------------
        // NESTED DECLARATION BOUNDARY
        // --------------------------------------------

        if (
            !isRoot &&
            isNestedDeclaration(node)
        ) {
            return;
        }


        // --------------------------------------------
        // THROW
        // --------------------------------------------

        if (
            node.type ===
            "throw_statement"
        ) {

            properties.throws++;


            const throwType =
                getThrowType(node);


            if (throwType) {

                properties.throwTypes.push(
                    throwType
                );
            }
        }


        // --------------------------------------------
        // RETURN
        // --------------------------------------------

        if (
            node.type ===
            "return_statement"
        ) {

            properties.returns++;


            if (
                isNullishReturn(node)
            ) {

                properties.returnsNullish++;
            }
        }


        // --------------------------------------------
        // CALL
        // --------------------------------------------

        if (
            node.type ===
            "call_expression"
        ) {

            const functionNode =
                node.childForFieldName(
                    "function"
                );


            const callName =
                getExpressionText(
                    functionNode
                );


            if (callName) {

                properties.calls.push(
                    callName
                );
            }
        }


        // --------------------------------------------
        // NUMBER
        // --------------------------------------------

        if (
            node.type === "number"
        ) {

            const value =
                Number(node.text);


            if (
                Number.isFinite(value)
            ) {

                properties.numbers.push(
                    value
                );
            }
        }


        // --------------------------------------------
        // AWAIT
        // --------------------------------------------

        if (
            node.type ===
            "await_expression"
        ) {

            properties.awaits++;
        }


        // --------------------------------------------
        // CATCH
        // --------------------------------------------

        if (
            node.type ===
            "catch_clause"
        ) {

            properties.catches++;


            if (
                isEmptyCatch(node)
            ) {

                properties.emptyCatches++;
            }
        }


        // --------------------------------------------
        // CHILDREN
        // --------------------------------------------

        for (
            const child
            of node.namedChildren
        ) {

            visit(child);
        }
    }


    visit(
        declarationNode,
        true
    );


    // ------------------------------------------------
    // SORT + DEDUPLICATE
    // ------------------------------------------------

    properties.throwTypes =
        [
            ...new Set(
                properties.throwTypes
            )
        ].sort();


    properties.calls =
        [
            ...new Set(
                properties.calls
            )
        ].sort();


    properties.numbers =
        [
            ...new Set(
                properties.numbers
            )
        ].sort(
            (a, b) => a - b
        );


    return properties;
}