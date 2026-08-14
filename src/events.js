import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// GET EVENTS PATH
// 1-Receives the project root.
// 2-Creates the .planmap directory when needed.
// 3-Returns the path to events.jsonl.
// --------------------------------------------------

function getEventsPath(
    projectRoot
) {
    const planmapDirectory =
        path.join(
            projectRoot,
            ".planmap"
        );

    fs.mkdirSync(
        planmapDirectory,
        {
            recursive: true
        }
    );

    return path.join(
        planmapDirectory,
        "events.jsonl"
    );
}


// --------------------------------------------------
// CREATE COMPACT DELTA
// 1-Receives a diff result.
// 2-Reads only the properties that changed.
// 3-Stores the old and new values.
// 4-Leaves locations and full declarations out.
// 5-Returns a compact delta object.
// --------------------------------------------------

function createCompactDelta(
    change
) {
    const delta = {};

    if (
        !change.changes
    ) {
        return delta;
    }

    for (
        const propertyChange
        of change.changes
    ) {
        delta[propertyChange.property] = [
            propertyChange.before,
            propertyChange.after
        ];
    }

    return delta;
}


// --------------------------------------------------
// APPEND EVENT
// 1-Receives the project root and diff result.
// 2-Ignores unchanged results.
// 3-Creates a compact event.
// 4-Appends exactly one JSON line.
// 5-Never rewrites existing events.
// --------------------------------------------------

export function appendEvent(
    projectRoot,
    change
) {
    if (
        change.type !== "changed" &&
        change.type !== "added" &&
        change.type !== "deleted"
    ) {
        return;
    }

    const eventsPath =
        getEventsPath(
            projectRoot
        );

    const event = {
        ts: new Date().toISOString(),
        identity: change.identity,
        type: change.type,
        delta:
            change.type === "changed"
                ? createCompactDelta(change)
                : {}
    };

    fs.appendFileSync(
        eventsPath,
        JSON.stringify(event) + "\n",
        "utf8"
    );
}