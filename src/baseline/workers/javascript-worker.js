import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    Parser,
    Language
} from "web-tree-sitter";

import { ensureTreeSitterInitialized } from "./tree-sitter-runtime.js";
import { walk } from "../walk.js";


// --------------------------------------------------
// GRAMMAR PATH
// --------------------------------------------------

const __dirname =
    path.dirname(
        fileURLToPath(import.meta.url)
    );

const javascriptWasmPath =
    path.resolve(
        __dirname,
        "../../../node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm"
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
