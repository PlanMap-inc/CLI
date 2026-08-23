import chokidar from "chokidar";

import {
    createWatcherHandlers
} from "./watcher/handlers.js";

import {
    shouldIgnore
} from "./watcher/filters.js";

import {
    createSessionManager
} from "./session-manager.js";

import {
    watchGitBoundary
} from "./git-watcher.js";

import {
    flushDebounces
} from "./watcher/debounce.js";


// --------------------------------------------------
// WATCH PROJECT
// --------------------------------------------------
// 1-Creates a Chokidar watcher for the project.
// 2-Uses the watcher filter for ignored paths.
// 3-Ignores the initial scan.
// 4-Creates in-memory watcher state.
// 5-Delegates add/change/unlink handling.
// 6-Keeps the watcher alive through Chokidar.
// 7-Closes the watcher cleanly on shutdown.
// --------------------------------------------------

export async function watchProject(
    projectRoot,
    parseFile
) {

    // --------------------------------------------------
    // IN-MEMORY WATCHER STATE
    // --------------------------------------------------

    const lastSeen =
        new Map();

    const lastSeenDeclarations =
        new Map();

    const sessionManager =
        createSessionManager(
            projectRoot
        );


    // --------------------------------------------------
    // GIT SESSION BOUNDARY
    // --------------------------------------------------

    const gitWatcher =
        await watchGitBoundary(
            projectRoot,
            async ({
                type,
                currentCommit,
                previousCommit,
                previousBranch,
                currentBranch
            }) => {

                // Git can move HEAD before Chokidar has
                // delivered the filesystem event generated
                // by the commit. Give the filesystem watcher
                // a short settle window first.
                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            500
                        )
                );

                // Drain every debounce callback that is
                // already queued or currently running.
                await flushDebounces();

                // A filesystem event can arrive during the
                // first flush. Give Chokidar one more short
                // window and drain again before sealing.
                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            100
                        )
                );

                await flushDebounces();

                if (
                    type ===
                    "branch-switch"
                ) {
                    console.log(
                        `Git branch switched: ${previousBranch} -> ${currentBranch}`
                    );

                    console.log(
                        "Discarding open PlanMap session."
                    );

                    sessionManager.discard();

                    return;
                }

                const sealedSession =
                    sessionManager.seal(
                        "git",
                        {
                            commit:
                                currentCommit,

                            previousCommit
                        }
                    );

                if (
                    sealedSession
                ) {
                    console.log(
                        `Session sealed by Git: ${sealedSession.id}`
                    );
                }
            }
        );


    // --------------------------------------------------
    // WATCHER CONTEXT
    // --------------------------------------------------

    const context = {
        projectRoot,

        parseFile,

        lastSeen,

        lastSeenDeclarations,

        sessionManager,

        debounceDelay:
            300
    };


    // --------------------------------------------------
    // CREATE HANDLERS
    // --------------------------------------------------

    const handlers =
        createWatcherHandlers(
            context
        );


    // --------------------------------------------------
    // CREATE CHOKIDAR WATCHER
    // --------------------------------------------------

    const watcher =
        chokidar.watch(
            projectRoot,
            {
                ignored: (
                    filePath,
                    stats
                ) =>
                    shouldIgnore(
                        filePath,
                        stats
                    ),

                ignoreInitial:
                    true,

                persistent:
                    true,

                awaitWriteFinish: {
                    stabilityThreshold:
                        200,

                    pollInterval:
                        100
                }
            }
        );


    // --------------------------------------------------
    // WATCHER READY
    // --------------------------------------------------

    watcher.on(
        "ready",
        () => {

            console.log(
                `\nWatching project: ${projectRoot}`
            );

            console.log(
                "Waiting for source file changes...\n"
            );
        }
    );


    // --------------------------------------------------
    // HANDLE ADDED FILE
    // --------------------------------------------------

    watcher.on(
        "add",
        filePath => {

            handlers.add(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // HANDLE CHANGED FILE
    // --------------------------------------------------

    watcher.on(
        "change",
        filePath => {

            handlers.change(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // HANDLE REMOVED FILE
    // --------------------------------------------------

    watcher.on(
        "unlink",
        filePath => {

            handlers.unlink(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // HANDLE WATCHER ERROR
    // --------------------------------------------------

    watcher.on(
        "error",
        error => {

            console.error(
                `Watcher error: ${error.message}`
            );
        }
    );


    // --------------------------------------------------
    // HANDLE WATCHER SHUTDOWN
    // --------------------------------------------------

    const shutdown =
        async () => {

            console.log(
                "\nStopping watcher..."
            );

            await watcher.close();

            if (
                gitWatcher
            ) {
                gitWatcher.close();
            }

            process.exit(
                0
            );
        };

    process.once(
        "SIGINT",
        shutdown
    );

    process.once(
        "SIGTERM",
        shutdown
    );
}