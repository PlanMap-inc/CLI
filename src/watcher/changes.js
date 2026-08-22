import fs from "node:fs";
import path from "node:path";

import { readBaseline } from "../check.js";
import { formatDiff, diffDeclarations } from "../diff.js";
import { appendEvent } from "../events.js";


// --------------------------------------------------
// RECORD CHANGES
// --------------------------------------------------
// 1-Receives the project root and detected changes.
// 2-Ignores unchanged results.
// 3-Reads existing events.jsonl.
// 4-Prevents duplicate events.
// 5-Appends real changes to events.jsonl.
// --------------------------------------------------

export function recordChanges(
    projectRoot,
    changes
) {
    const eventsPath =
        path.join(
            projectRoot,
            ".planmap",
            "events.jsonl"
        );

    let existingEvents =
        new Set();

    if (
        fs.existsSync(
            eventsPath
        )
    ) {
        const existingText =
            fs.readFileSync(
                eventsPath,
                "utf8"
            );

        for (
            const line
            of existingText.split("\n")
        ) {
            const trimmed =
                line.trim();

            if (
                !trimmed
            ) {
                continue;
            }

            try {
                const event =
                    JSON.parse(
                        trimmed
                    );

                existingEvents.add(
                    JSON.stringify({
                        identity:
                            event.identity,

                        type:
                            event.type,

                        delta:
                            event.delta || {}
                    })
                );
            } catch {
                // Ignore malformed historical lines.
            }
        }
    }

    const uniqueChanges =
        changes.filter(
            change => {
                const key =
                    JSON.stringify({
                        identity:
                            change.identity,

                        type:
                            change.type,

                        delta:
                            change.delta || {}
                    });

                if (
                    existingEvents.has(
                        key
                    )
                ) {
                    return false;
                }

                existingEvents.add(
                    key
                );

                return true;
            }
        );

    if (
        uniqueChanges.length === 0
    ) {
        return [];
    }

    for (
        const change
        of uniqueChanges
    ) {
        appendEvent(
            projectRoot,
            change
        );
    }

    return uniqueChanges;
}


// --------------------------------------------------
// CHECK CHANGED FILE
// --------------------------------------------------
// 1-Reads the stored baseline.
// 2-Parses only the changed file.
// 3-Gets the current declarations.
// 4-Compares the current facts with the last seen facts.
// 5-Ignores repeated identical saves.
// 6-Compares new facts with the previous state.
// 7-Records real changes.
// 8-Prints only a new drift.
// 9-Does not update baseline.json.
// --------------------------------------------------

export function checkChangedFile(
    projectRoot,
    filePath,
    parseFile,
    lastSeen,
    lastSeenDeclarations
) {
    const baseline =
        readBaseline(
            projectRoot
        );

    const relativeFile =
        path.relative(
            projectRoot,
            filePath
        )
        .split(path.sep)
        .join("/");

    const baselineDeclarations =
        baseline.declarations.filter(
            declaration =>
                declaration.file ===
                relativeFile
        );

    const result =
        parseFile(
            filePath,
            {
                throwOnError: true
            }
        );

    const currentDeclarations =
        result.declarations;

    for (
        const declaration
        of currentDeclarations
    ) {
        declaration.file =
            relativeFile;

        declaration.identity =
            `${relativeFile}::${declaration.identity}`;
    }

    const currentSignature =
        createSignature(
            currentDeclarations
        );

    const previousSignature =
        lastSeen.get(
            relativeFile
        );

    if (
        previousSignature ===
        currentSignature
    ) {
        return;
    }

    /*
     * First observation:
     * use baseline as the previous state.
     *
     * Later observations:
     * use the last successfully observed declarations.
     */

    const previousDeclarations =
        lastSeenDeclarations.has(
            relativeFile
        )
            ? lastSeenDeclarations.get(
                relativeFile
            )
            : baselineDeclarations;

    lastSeen.set(
        relativeFile,
        currentSignature
    );

    lastSeenDeclarations.set(
        relativeFile,
        currentDeclarations
    );

    const changes =
        diffDeclarations(
            previousDeclarations,
            currentDeclarations
        );

    const realChanges =
        changes.filter(
            change =>
                change.type === "changed" ||
                change.type === "added" ||
                change.type === "deleted"
        );

    if (
        realChanges.length === 0
    ) {
        return;
    }

    const recordedChanges =
        recordChanges(
            projectRoot,
            realChanges
        );

    console.log(
        `\nChange detected: ${relativeFile}\n`
    );

    formatDiff(
        realChanges,
        "previous",
        "current"
    );

    return recordedChanges;
}


// --------------------------------------------------
// CHECK REMOVED FILE
// --------------------------------------------------
// 1-Reads the stored baseline.
// 2-Gets declarations belonging to the removed file.
// 3-Compares them with an empty declaration list.
// 4-Reports real deletions.
// 5-Records the deletion in events.jsonl.
// 6-Does not update baseline.json.
// --------------------------------------------------

export function checkRemovedFile(
    projectRoot,
    filePath,
    lastSeen
) {
    const baseline =
        readBaseline(
            projectRoot
        );

    const relativeFile =
        path.relative(
            projectRoot,
            filePath
        )
        .split(path.sep)
        .join("/");

    const baselineDeclarations =
        baseline.declarations.filter(
            declaration =>
                declaration.file ===
                relativeFile
        );

    if (
        baselineDeclarations.length === 0
    ) {
        return;
    }

    const currentSignature =
        createSignature(
            []
        );

    const previousSignature =
        lastSeen.get(
            relativeFile
        );

    if (
        previousSignature ===
        currentSignature
    ) {
        return;
    }

    lastSeen.set(
        relativeFile,
        currentSignature
    );

    const changes =
        diffDeclarations(
            baselineDeclarations,
            []
        );

    const realChanges =
        changes.filter(
            change =>
                change.type === "changed" ||
                change.type === "added" ||
                change.type === "deleted"
        );

    if (
        realChanges.length === 0
    ) {
        return;
    }

    const recordedChanges =
        recordChanges(
            projectRoot,
            realChanges
        );

    console.log(
        `\nChange detected: ${relativeFile}\n`
    );

    formatDiff(
        realChanges,
        "baseline",
        "current"
    );

    return recordedChanges;
}


// --------------------------------------------------
// CREATE SIGNATURE
// --------------------------------------------------
// 1-Receives declarations.
// 2-Keeps stable declaration information.
// 3-Leaves line numbers and byte offsets out.
// 4-Sorts declarations by identity.
// 5-Returns a stable JSON signature.
// --------------------------------------------------

function createSignature(
    declarations
) {
    return JSON.stringify(
        declarations
            .map(
                declaration => ({
                    identity:
                        declaration.identity,

                    file:
                        declaration.file,

                    kind:
                        declaration.kind,

                    properties:
                        declaration.properties
                })
            )
            .sort(
                (left, right) =>
                    left.identity.localeCompare(
                        right.identity
                    )
            )
    );
}