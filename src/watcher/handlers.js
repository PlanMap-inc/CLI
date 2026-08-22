import {
    debounceFile,
    clearDebounce
} from "./debounce.js";

import {
    shouldIgnore
} from "./filters.js";

import {
    checkChangedFile,
    checkRemovedFile
} from "./changes.js";


// --------------------------------------------------
// HANDLE FILE ADD
// --------------------------------------------------
// A newly added JavaScript file is processed through
// the same change-detection path used for changes.
// --------------------------------------------------

export function handleAdd(
    filePath,
    context
) {

    if (
        shouldIgnore(
            filePath
        )
    ) {
        return;
    }

    debounceFile(
        filePath,
        async () => {

            try {

                const recordedChanges =
                    await checkChangedFile(
                        context.projectRoot,
                        filePath,
                        context.parseFile,
                        context.lastSeen,
                        context.lastSeenDeclarations
                    );

                context.sessionManager.addEvents(
                    recordedChanges
                );

            } catch (error) {

                console.error(
                    `Unable to check added file ${filePath}: ${error.message}`
                );
            }

        },
        context.debounceDelay
    );
}


// --------------------------------------------------
// HANDLE FILE CHANGE
// --------------------------------------------------
// 1-Checks whether the file should be ignored.
// 2-Debounces rapid filesystem events.
// 3-Processes the file after the debounce delay.
// --------------------------------------------------

export function handleChange(
    filePath,
    context
) {

    if (
        shouldIgnore(
            filePath
        )
    ) {
        return;
    }

    debounceFile(
        filePath,
        async () => {

            try {

                const recordedChanges =
                    await checkChangedFile(
                        context.projectRoot,
                        filePath,
                        context.parseFile,
                        context.lastSeen,
                        context.lastSeenDeclarations
                    );

                context.sessionManager.addEvents(
                    recordedChanges
                );

            } catch (error) {

                console.error(
                    `Unable to check changed file ${filePath}: ${error.message}`
                );
            }

        },
        context.debounceDelay
    );
}


// --------------------------------------------------
// HANDLE FILE UNLINK
// --------------------------------------------------
// 1-Cancels any pending debounce.
// 2-Ignores files outside the watcher scope.
// 3-Processes the removed file.
// --------------------------------------------------

export function handleUnlink(
    filePath,
    context
) {

    if (
        shouldIgnore(
            filePath
        )
    ) {
        return;
    }

    clearDebounce(
        filePath
    );

    try {

        checkRemovedFile(
            context.projectRoot,
            filePath,
            context.lastSeen
        );

    } catch (error) {

        console.error(
            `Unable to check removed file ${filePath}: ${error.message}`
        );
    }
}


// --------------------------------------------------
// CREATE WATCHER HANDLERS
// --------------------------------------------------
// Returns the callbacks used by the filesystem
// watcher.
// --------------------------------------------------

export function createWatcherHandlers(
    context
) {

    return {

        add(
            filePath
        ) {

            handleAdd(
                filePath,
                context
            );
        },

        change(
            filePath
        ) {

            handleChange(
                filePath,
                context
            );
        },

        unlink(
            filePath
        ) {

            handleUnlink(
                filePath,
                context
            );
        }
    };
}