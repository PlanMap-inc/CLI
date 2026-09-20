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
        case "abstract_class_declaration":
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

// --------------------------------------------------
// ENTRIES OF A NAMED LIST OR TABLE
// --------------------------------------------------
// The facts a function has - throws, returns, awaits - say nothing about a
// list. What matters about one is what is in it and how many: a route
// table's routes, a survey's questions, a status map's codes. Read straight
// off the literal, so they are as checkable as any other fact.
// --------------------------------------------------

const QUOTES = /^["'`]|["'`]$/g;

function readEntries(
    declarationNode
) {
    const value =
        declarationNode?.childForFieldName?.(
            "value"
        );

    if (
        value?.type !== "array" &&
        value?.type !== "object"
    ) {
        return null;
    }

    const entries = [];

    for (
        let index = 0;
        index < value.namedChildCount;
        index++
    ) {
        const child =
            value.namedChild(index);

        if (
            !child ||
            child.type === "comment"
        ) {
            continue;
        }

        // An object's entries are its keys; an array's are its values.
        const shown =
            value.type === "object"
                ? child.childForFieldName?.("key")?.text
                : child.text;

        if (
            typeof shown === "string"
        ) {
            entries.push(
                shown
                    .replace(QUOTES, "")
                    .trim()
            );
        }
    }

    return {
        shape:
            value.type,

        entryCount:
            entries.length,

        // Bounded: a list of thousands is a fact about its length, and
        // every entry would swamp the prompt it is there to inform.
        entries:
            entries.slice(0, 60)
    };
}


export function extractProperties(
    declarationNode
) {

    const list =
        readEntries(
            declarationNode
        );

    const properties = {

        throws: 0,

        throwTypes: [],

        returns: 0,

        returnsNullish: 0,

        calls: [],

        // A bare identifier handed off as an object-literal property value -
        // { callback: handleCredentialResponse } - rather than invoked. Not
        // a call: nothing here says the declaration runs it, only that it
        // hands the reference to something else, which may run it later, or
        // never. Kept apart from "calls" so a reading built from it never
        // claims an invocation that isn't there.
        callbacks: [],

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
        // CALLBACK REFERENCE
        // --------------------------------------------
        // An object-literal pair whose value is a bare identifier:
        // { callback: handleCredentialResponse }. The declaration named by
        // that identifier is not called here - it is handed off, to be run
        // by whatever the object is passed to. A pair whose value is a
        // function itself (arrow_function / function_expression) is a
        // nested declaration boundary already handled above, not this case.
        // --------------------------------------------

        if (
            node.type === "pair"
        ) {

            const value =
                node.childForFieldName(
                    "value"
                );


            if (
                value?.type === "identifier"
            ) {

                properties.callbacks.push(
                    value.text
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


    properties.callbacks =
        [
            ...new Set(
                properties.callbacks
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


    // A named list carries its own facts instead of a function's, which for
    // it are all zero and mean nothing.
    if (
        list
    ) {
        properties.shape =
            list.shape;

        properties.entryCount =
            list.entryCount;

        properties.entries =
            list.entries;
    }


    return properties;
}