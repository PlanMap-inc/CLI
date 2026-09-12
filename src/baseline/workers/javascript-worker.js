import { createRequire } from "node:module";

import {
    Parser,
    Language
} from "web-tree-sitter";

import { ensureTreeSitterInitialized } from "./tree-sitter-runtime.js";
import { walk } from "../walk.js";


// --------------------------------------------------
// GRAMMAR PATH
// --------------------------------------------------
// Resolved via Node's module resolution (package-relative),
// not a hard-coded "../.." depth from this file's location.
// --------------------------------------------------

const require =
    createRequire(import.meta.url);

const javascriptWasmPath =
    require.resolve(
        "tree-sitter-javascript/tree-sitter-javascript.wasm"
    );


// --------------------------------------------------
// LOAD GRAMMAR
// --------------------------------------------------

await ensureTreeSitterInitialized();

const javascriptLanguage =
    await Language.load(javascriptWasmPath);


// --------------------------------------------------
// JAVASCRIPT WORKER
// --------------------------------------------------

export const javascriptWorker = {
    name: "javascript",

    extensions: [".js"],

    parse(code) {
        const parser = new Parser();
        parser.setLanguage(javascriptLanguage);
        return parser.parse(code);
    },

    extractDeclarations(tree) {
        return walk(tree.rootNode);
    }
};
