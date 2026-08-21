import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    Parser,
    Language
} from "web-tree-sitter";

import {
    walk
} from "./walk.js";



// --------------------------------------------------
// TREE-SITTER INITIALIZATION
// --------------------------------------------------

const __filename =
    fileURLToPath(
        import.meta.url
    );

const __dirname =
    path.dirname(
        __filename
    );


// --------------------------------------------------
// WASM PATHS
// --------------------------------------------------

const javascriptWasmPath =
    path.resolve(
        __dirname,
        "../node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm"
    );


const typescriptWasmPath =
    path.resolve(
        __dirname,
        "../node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm"
    );


const tsxWasmPath =
    path.resolve(
        __dirname,
        "../node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm"
    );



await Parser.init();


// --------------------------------------------------
// LOAD LANGUAGES
// --------------------------------------------------

const javascriptLanguage =
    await Language.load(
        javascriptWasmPath
    );


const typescriptLanguage =
    await Language.load(
        typescriptWasmPath
    );


const tsxLanguage =
    await Language.load(
        tsxWasmPath
    );



// --------------------------------------------------
// SELECT LANGUAGE
// --------------------------------------------------

function getLanguageForFile(
    filePath
) {

    const extension =
        path
            .extname(
                filePath
            )
            .toLowerCase();


    if (
        extension === ".tsx"
    ) {

        return tsxLanguage;
    }


    if (
        extension === ".ts"
    ) {

        return typescriptLanguage;
    }


    return javascriptLanguage;
}



// --------------------------------------------------
// PARSE FILE
// --------------------------------------------------
// 1-Receives the file path.
// 2-Converts the path into an absolute path.
// 3-Checks whether the file exists.
// 4-Reads the entire file.
// 5-Creates a new Tree-sitter parser.
// 6-Selects the grammar from the file extension.
// 7-Parses the source code.
// 8-Throws an error when throwOnError is enabled.
// 9-Sends the syntax tree to walk().
// 10-Returns the parsed file information.
// --------------------------------------------------

export function parseFile(
    filePath,
    options = {}
) {

    const absolutePath =
        path.resolve(
            filePath
        );


    if (
        !fs.existsSync(
            absolutePath
        )
    ) {

        const error =
            new Error(
                `Cannot read file: ${filePath}`
            );


        if (
            options.throwOnError
        ) {

            throw error;
        }


        console.error(
            error.message
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


    const language =
        getLanguageForFile(
            absolutePath
        );


    parser.setLanguage(
        language
    );


    const tree =
        parser.parse(
            fileCode
        );


    if (
        tree.rootNode.hasError
    ) {

        throw new Error(
            `Parse errors detected in ${filePath}`
        );
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
