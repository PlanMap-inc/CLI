// src/cli.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    Parser,
    Language
} from "web-tree-sitter";

import { walk } from "./walk.js";

import {
    diffDeclarations,
    formatDiff
} from "./diff.js";


// --------------------------------------------------
// PATHS
// --------------------------------------------------

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);


const wasmPath =
    path.resolve(
        __dirname,
        "../node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm"
    );


// --------------------------------------------------
// INITIALIZE PARSER
// --------------------------------------------------

await Parser.init();

const jslang =
    await Language.load(
        wasmPath
    );


// --------------------------------------------------
// PARSE FILE
// --------------------------------------------------

function parseFile(filePath) {

    const absolutePath =
        path.resolve(filePath);


    if (
        !fs.existsSync(
            absolutePath
        )
    ) {

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


    const parser =
        new Parser();

    parser.setLanguage(
        jslang
    );


    const tree =
        parser.parse(
            fileCode
        );


    // ----------------------------------------------
    // PARSE ERROR
    // ----------------------------------------------

    if (
        tree.rootNode.hasError
    ) {

        console.error(
            `Parse errors detected in ${filePath}`
        );

        process.exit(1);
    }


    const declarations =
        walk(
            tree.rootNode
        );


    return {
        filePath,
        code: fileCode,
        tree,
        declarations
    };
}


// --------------------------------------------------
// PRINT DECLARATIONS
// --------------------------------------------------

function printDeclarations(
    filePath,
    declarations
) {

    console.log(
        `\nFile: ${filePath}\n`
    );


    // ----------------------------------------------
    // EMPTY FILE
    // ----------------------------------------------

    if (
        declarations.length === 0
    ) {

        console.log(
            "No declarations found."
        );

        return;
    }


    const nameWidth =
        Math.max(
            "name".length,
            ...declarations.map(
                declaration =>
                    declaration.name.length
            )
        ) + 2;


    console.log(
        "kind".padEnd(24) +
        "name".padEnd(nameWidth) +
        "location"
    );


    console.log(
        "-".repeat(
            24 +
            nameWidth +
            20
        )
    );


    for (
        const declaration
        of declarations
    ) {

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


// --------------------------------------------------
// CHECK DUPLICATE IDENTITIES
// --------------------------------------------------

function checkDuplicates(
    declarations
) {

    const identities =
        new Set();


    for (
        const declaration
        of declarations
    ) {

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
}


// --------------------------------------------------
// RUN DIFF
// --------------------------------------------------

function runDiff(
    beforePath,
    afterPath
) {

    if (
        !beforePath ||
        !afterPath
    ) {

        console.error(
            "Usage: node src/cli.js diff <before> <after>"
        );

        process.exit(1);
    }


    const before =
        parseFile(
            beforePath
        );


    const after =
        parseFile(
            afterPath
        );


    const changes =
        diffDeclarations(
            before.declarations,
            after.declarations
        );


    formatDiff(
        changes,
        beforePath,
        afterPath
    );
}


// --------------------------------------------------
// MAIN CLI
// --------------------------------------------------

const args =
    process.argv.slice(2);


// --------------------------------------------------
// NO ARGUMENTS
// --------------------------------------------------

if (
    args.length === 0
) {

    console.error(
        "Usage:"
    );

    console.error(
        "  node src/cli.js <file>"
    );

    console.error(
        "  node src/cli.js <file> --json"
    );

    console.error(
        "  node src/cli.js diff <before> <after>"
    );

    process.exit(1);
}


// --------------------------------------------------
// DIFF COMMAND
// --------------------------------------------------

if (
    args[0] === "diff"
) {

    runDiff(
        args[1],
        args[2]
    );
}


// --------------------------------------------------
// NORMAL FILE COMMAND
// --------------------------------------------------

else {

    const filePath =
        args[0];


    const json =
        args.includes(
            "--json"
        );


    const result =
        parseFile(
            filePath
        );


    checkDuplicates(
        result.declarations
    );


    if (json) {

        console.log(
            JSON.stringify(
                result.declarations,
                null,
                2
            )
        );
    }

    else {

        printDeclarations(
            filePath,
            result.declarations
        );
    }
}