// src/cli.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Parser, Language } from "web-tree-sitter";
import { walk } from "./walk.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// --------------------------------------------------
// READ FILE PATH
// --------------------------------------------------

const filePath = process.argv[2];

if (!filePath) {
    console.error(
        "Usage: node src/cli.js <file>"
    );

    process.exit(1);
}


const absolutePath =
    path.resolve(filePath);


// --------------------------------------------------
// READ FILE
// --------------------------------------------------

if (!fs.existsSync(absolutePath)) {

    console.error(
        `Cannot read file: ${filePath}`
    );

    process.exit(1);
}


const fileCode =
    fs.readFileSync(
        absolutePath,
        "utf8"
    );


// --------------------------------------------------
// INITIALIZE TREE-SITTER
// --------------------------------------------------

await Parser.init();


const wasmPath = path.resolve(
    __dirname,
    "../node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm"
);


const jslang =
    await Language.load(wasmPath);


const parser = new Parser();

parser.setLanguage(jslang);


// --------------------------------------------------
// PARSE FILE
// --------------------------------------------------

const tree =
    parser.parse(fileCode);


if (tree.rootNode.hasError) {
    console.error("Parse errors detected");
    process.exit(1);
}


// --------------------------------------------------
// BUILD DECLARATION INVENTORY
// --------------------------------------------------

const declarations =
    walk(tree.rootNode);


// --------------------------------------------------
// CHECK DUPLICATE IDENTITIES
// --------------------------------------------------

const identities = new Set();


for (const declaration of declarations) {

    if (
        identities.has(
            declaration.identity
        )
    ) {

        console.warn(
            `Duplicate identity: ${declaration.identity}`
        );
    }

    identities.add(
        declaration.identity
    );
}


// --------------------------------------------------
// PRINT INVENTORY
// --------------------------------------------------

function printDeclarations(filePath, declarations) {
    console.log(`\nFile: ${filePath}\n`);

    if (declarations.length === 0) {
        console.log("No declarations found.");
        return;
    }

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
        "-".repeat(
            24 + nameWidth + 20
        )
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


printDeclarations(
    filePath,
    declarations
);