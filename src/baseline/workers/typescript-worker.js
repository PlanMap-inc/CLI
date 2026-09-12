import path from "node:path";
import { createRequire } from "node:module";

import {
    Parser,
    Language
} from "web-tree-sitter";

import { ensureTreeSitterInitialized } from "./tree-sitter-runtime.js";
import { walk } from "../walk.js";


// --------------------------------------------------
// GRAMMAR PATHS
// --------------------------------------------------
// Resolved via Node's module resolution (package-relative),
// not a hard-coded "../.." depth from this file's location.
// --------------------------------------------------

const require =
    createRequire(import.meta.url);

const typescriptWasmPath =
    require.resolve(
        "tree-sitter-typescript/tree-sitter-typescript.wasm"
    );

const tsxWasmPath =
    require.resolve(
        "tree-sitter-typescript/tree-sitter-tsx.wasm"
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
