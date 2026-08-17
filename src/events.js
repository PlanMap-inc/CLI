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

    /*
     * Prevent consecutive duplicate events.
     *
     * Chokidar may cause the same logical change to reach
     * appendEvent() more than once.
     *
     * Compare against the LAST persisted event only.
     *
     * This prevents:
     *
     *   200 → 203
     *   200 → 203
     *
     * while still allowing a legitimate later recurrence:
     *
     *   200 → 203
     *   203 → 200
     *   200 → 203
     */

    if (fs.existsSync(eventsPath)) {
        const existingContent =
            fs.readFileSync(
                eventsPath,
                "utf8"
            );

        const lines =
            existingContent
                .split("\n")
                .filter(
                    line =>
                        line.trim()
                );

        if (lines.length > 0) {
            try {
                const lastEvent =
                    JSON.parse(
                        lines[lines.length - 1]
                    );

                const sameEvent =
                    lastEvent.identity ===
                        event.identity &&
                    lastEvent.type ===
                        event.type &&
                    JSON.stringify(
                        lastEvent.delta || {}
                    ) ===
                        JSON.stringify(
                            event.delta || {}
                        );

                if (sameEvent) {
                    return;
                }
            } catch {
                // Ignore malformed historical lines.
                // The new event can still be appended.
            }
        }
    }

    fs.appendFileSync(
        eventsPath,
        JSON.stringify(event) + "\n",
        "utf8"
    );
}


// --------------------------------------------------
// APPEND INITIAL EVENTS
// 1-Receives the project root and initial declarations.
// 2-Creates one "added" event for every declaration.
// 3-Uses the declaration identity as the event identity.
// 4-Uses an empty delta for initial declarations.
// 5-Appends the initial events to events.jsonl.
// 6-Does not create duplicate initial events when
//    events.jsonl already exists.
// --------------------------------------------------

export function appendInitialEvents(
    projectRoot,
    declarations
) {
    const eventsPath =
        getEventsPath(
            projectRoot
        );

    if (
        fs.existsSync(
            eventsPath
        )
    ) {
        const existingEvents =
            fs.readFileSync(
                eventsPath,
                "utf8"
            ).trim();

        if (
            existingEvents.length > 0
        ) {
            return;
        }
    }

    const timestamp =
        new Date().toISOString();

    for (
        const declaration
        of declarations
    ) {
        const event = {
            ts: timestamp,
            identity: declaration.identity,
            type: "added",
            delta: {}
        };

        fs.appendFileSync(
            eventsPath,
            JSON.stringify(event) + "\n",
            "utf8"
        );
    }
}