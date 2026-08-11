// PLAN_MAP-v0.1
// CLI that reads a JavaScript file, parses it with Tree-sitter WASM,
// builds its syntax tree, and creates a structural inventory.

//importing the modules
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Parser, Language } from "web-tree-sitter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//reading the file path from command line arguments
const filePath = process.argv[2];

//checking if the file path is provided and if the file exists
if (!filePath) {
    console.error("Usage: node src/cli.js <file>");
    process.exit(1);
}
const absolutePath = path.resolve(filePath);

//checking if the file exists and reading its content and making a string
if (!fs.existsSync(absolutePath)) {
    console.error(`Cannot read file: ${filePath}`);
    process.exit(1);
}
const fileCode = fs.readFileSync(absolutePath, "utf8");

//Initializing the parser
await Parser.init();

//Loading the JS grammer
const wasmPath = path.resolve(
    __dirname,
    "../node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm"
);
const jslang = await Language.load(wasmPath);

//creating a parser and setting the grammer 
const parser = new Parser();
parser.setLanguage(jslang);

//creating the tree
const tree = parser.parse(fileCode);
if (tree.rootNode.hasError) {
    console.error("Parse errors detected");
}


// This function gets the name of a declaration from the syntax tree.
// It looks for the "name" part of the node.
// If a name is found, it returns that name.
// If no name is found, it returns "<anonymous>".
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
// This function creates a simple record for a declaration.
// It stores the declaration's type, name, and exact location in the file.
// This information is later used to build and print our structural inventory.
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




// This function goes through the syntax tree and finds declarations.
const declarations = [];

function walk(node, scope = []) {

    let currentScope = scope;

    // Classes
    if (node.type === "class_declaration") {
        const name = getDeclarationName(node);

        if (name !== "<anonymous>") {
            const qualifiedName = [...scope, name].join(".");

            declarations.push(
                createDeclaration(node, qualifiedName, "class")
            );

            currentScope = [...scope, name];
        }
    }

    // Variables containing objects, classes, or functions
    if (node.type === "variable_declarator") {
        const name = getDeclarationName(node);
        const value = node.childForFieldName("value");

        if (
            value?.type === "object" &&
            name !== "<anonymous>"
        ) {
            currentScope = [...scope, name];
        }

        if (
            value?.type === "class" &&
            name !== "<anonymous>"
        ) {
            const qualifiedName = [...scope, name].join(".");

            declarations.push(
                createDeclaration(node, qualifiedName, "class")
            );

            currentScope = [...scope, name];
        }

        if (
            (
                value?.type === "arrow_function" ||
                value?.type === "function_expression"
            ) &&
            name !== "<anonymous>"
        ) {
            const qualifiedName = [...scope, name].join(".");

            declarations.push(
                createDeclaration(node, qualifiedName, "function")
            );

            currentScope = [...scope, name];
        }
    }

    // Normal and generator functions
    if (
        node.type === "function_declaration" ||
        node.type === "generator_function_declaration"
    ) {
        const name = getDeclarationName(node);

        if (name !== "<anonymous>") {
            const qualifiedName = [...scope, name].join(".");

            declarations.push(
                createDeclaration(node, qualifiedName, "function")
            );

            currentScope = [...scope, name];
        }
    }

    

    // Methods
    if (node.type === "method_definition") {
        const nameNode = node.childForFieldName("name");

        if (
            nameNode &&
            nameNode.type !== "computed_property_name"
        ) {
            const name = nameNode.text;

            const childTypes = node.children.map(
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
            } else if (childTypes.includes("set")) {
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

    // Object properties containing functions
    if (node.type === "pair") {
        const key = node.childForFieldName("key");
        const value = node.childForFieldName("value");

        if (
            key &&
            key.type !== "computed_property_name" &&
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

    // Class fields containing functions
    if (node.type === "field_definition") {
        const property = node.childForFieldName("property");
        const value = node.childForFieldName("value");

        if (
            property &&
            property.type !== "computed_property_name" &&
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

    // Assignments containing objects or functions
    if (node.type === "assignment_expression") {
        const left = node.childForFieldName("left");
        const right = node.childForFieldName("right");

        const leftName = getExpressionText(left);

        // Example: module.exports = {}
        if (
            leftName &&
            right?.type === "object"
        ) {
            currentScope = [
                ...scope,
                leftName
            ];
        }

        // Example: module.exports.handler = () => {}
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

    // Visit children using the updated scope
    for (const child of node.namedChildren) {
        walk(child, currentScope);
    }
}


// This function prints all the declarations found in the JavaScript file.
// It shows the declaration type, name, and its location in the source code.
function printDeclarations(filePath, declarations) {

    console.log(`\nFile: ${filePath}\n`);

    const nameWidth =
        Math.max(
            "name".length,
            ...declarations.map(
                declaration => declaration.name.length
            )
        ) + 2;

    console.log(
        "kind".padEnd(24) +
        "name".padEnd(nameWidth) +
        "location"
    );

    console.log(
        "-".repeat(24 + nameWidth + 20)
    );

    for (const declaration of declarations) {

        const location =
            `${declaration.startLine}:${declaration.startColumn}` +
            `-${declaration.endLine}:${declaration.endColumn}`;

        const displayKind =
    declaration.modifiers.length > 0
        ? `${declaration.kind} [${declaration.modifiers.join(", ")}]`
        : declaration.kind;

console.log(
    displayKind.padEnd(24) +
    declaration.name.padEnd(nameWidth) +
    location
);
    }

    console.log(
        `\n${declarations.length} declarations`
    );
}


// Start walking through the syntax tree from its root node.
// This searches the entire JavaScript file for declarations.
walk(tree.rootNode);
const identities = new Set();

for (const declaration of declarations) {
    if (identities.has(declaration.identity)) {
        console.warn(
            `Duplicate identity: ${declaration.identity}`
        );
    }

    identities.add(declaration.identity);
}

printDeclarations(filePath, declarations);
//console.log(tree.rootNode.toString());
