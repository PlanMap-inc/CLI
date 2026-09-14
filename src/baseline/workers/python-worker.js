import { createRequire } from "node:module";

import {
    Parser,
    Language
} from "web-tree-sitter";

import { ensureTreeSitterInitialized } from "./tree-sitter-runtime.js";
import { extractPythonDeclarations } from "../walkers/python-walker.js";


// --------------------------------------------------
// GRAMMAR PATH
// --------------------------------------------------

const require =
    createRequire(import.meta.url);

const pythonWasmPath =
    require.resolve(
        "tree-sitter-python/tree-sitter-python.wasm"
    );


// --------------------------------------------------
// LOAD GRAMMAR
// --------------------------------------------------

await ensureTreeSitterInitialized();

const pythonLanguage =
    await Language.load(pythonWasmPath);


// --------------------------------------------------
// PYTHON WORKER
// --------------------------------------------------

export const pythonWorker = {

    name: "python",

    extensions: [".py"],

    parse(code) {
        const parser = new Parser();
        parser.setLanguage(pythonLanguage);
        return parser.parse(code);
    },

    extractDeclarations(tree) {
        return extractPythonDeclarations(tree.rootNode);
    }
};