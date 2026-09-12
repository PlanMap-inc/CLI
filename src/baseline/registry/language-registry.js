import path from "node:path";

import { javascriptWorker } from "../workers/javascript-worker.js";
import { typescriptWorker } from "../workers/typescript-worker.js";


// --------------------------------------------------
// LANGUAGE REGISTRY
// --------------------------------------------------
// Dispatch only: maps an extension to the worker that owns
// grammar loading and declaration extraction for it.
// --------------------------------------------------

const workersByExtension = new Map();

export function registerWorker(worker) {
    for (const extension of worker.extensions) {
        workersByExtension.set(extension, worker);
    }
}

export function getWorkerForFile(filePath) {
    const extension =
        path.extname(filePath).toLowerCase();

    const worker =
        workersByExtension.get(extension);

    if (!worker) {
        throw new Error(
            `Unsupported language for file: ${filePath}`
        );
    }

    return worker;
}


registerWorker(javascriptWorker);
registerWorker(typescriptWorker);
