import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    Parser,
    Language
} from "web-tree-sitter";

import { ensureTreeSitterInitialized } from "./tree-sitter-runtime.js";
import { walk } from "../walk.js";


// --------------------------------------------------
// GRAMMAR PATHS
// --------------------------------------------------

const __dirname =
    path.dirname(
        fileURLToPath(import.meta.url)
    );

const typescriptWasmPath =
    path.resolve(
        __dirname,
        "../../../node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm"
    );

const tsxWasmPath =
    path.resolve(
        __dirname,
        "../../../node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm"
    );


// --------------------------------------------------
// LOAD GRAMMARS
// --------------------------------------------------

await ensureTreeSitterInitialized();

const typescriptLanguage =
    await Language.load(typescriptWasmPath);

const tsxLanguage =
    await Language.load(tsxWasmPath);


// --------------------------------------------------
// GRAMMAR SELECTION
// --------------------------------------------------

function getGrammarForFile(filePath) {
    const extension =
        path.extname(filePath).toLowerCase();

    if (extension === ".tsx") {
        return tsxLanguage;
    }

    return typescriptLanguage;
}


// --------------------------------------------------
// TYPESCRIPT WORKER
// --------------------------------------------------

export const typescriptWorker = {
    name: "typescript",

    extensions: [".ts", ".tsx"],

    parse(code, filePath) {
        const parser = new Parser();
        parser.setLanguage(getGrammarForFile(filePath));
        return parser.parse(code);
    },

    extractDeclarations(tree) {
        return walk(tree.rootNode);
    }
};
