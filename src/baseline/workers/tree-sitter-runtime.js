import { Parser } from "web-tree-sitter";


// --------------------------------------------------
// SHARED TREE-SITTER RUNTIME INIT
// --------------------------------------------------
// Parser.init() is not idempotent - each worker loads its own
// grammar but must not re-run the WASM runtime bootstrap.
// --------------------------------------------------

let initPromise = null;

export function ensureTreeSitterInitialized() {
    if (!initPromise) {
        initPromise = Parser.init();
    }

    return initPromise;
}
