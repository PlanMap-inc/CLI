import fs from "node:fs";
import path from "node:path";

import {
    analyzeSignificance
} from "./evolution/significance.js";


// --------------------------------------------------
// GET SESSIONS PATH
// --------------------------------------------------

function getSessionsPath(
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
        "sessions.json"
    );
}


// --------------------------------------------------
// CREATE EMPTY SESSION
// --------------------------------------------------

export function createSession() {
    return {
        id:
            `session-${Date.now()}`,

        openedAt:
            new Date().toISOString(),

        sealedAt:
            null,

        sealed:
            false,

        events:
            []
    };
}


// --------------------------------------------------
// ADD EVENT
// --------------------------------------------------

export function addEventToSession(
    session,
    event
) {
    if (
        session.sealed
    ) {
        throw new Error(
            "Cannot add an event to a sealed session."
        );
    }

    session.events.push(
        event
    );

    return session;
}


// --------------------------------------------------
// DISTINCT IDENTITIES
// --------------------------------------------------

export function getDistinctIdentities(
    session
) {
    return new Set(
        session.events.map(
            event =>
                event.identity
        )
    );
}


// --------------------------------------------------
// NET DELTA
// --------------------------------------------------

export function calculateNetDelta(
    events
) {
    const states =
        new Map();

    for (
        const event
        of events
    ) {
        const identity =
            event.identity;

        if (
            event.type === "added" ||
            event.type === "deleted"
        ) {
            continue;
        }

        if (
            !states.has(
                identity
            )
        ) {
            states.set(
                identity,
                new Map()
            );
        }

        const properties =
            states.get(
                identity
            );

        for (
            const [
                property,
                values
            ]
            of Object.entries(
                event.delta || {}
            )
        ) {
            if (
                !properties.has(
                    property
                )
            ) {
                properties.set(
                    property,
                    {
                        before:
                            values[0],

                        after:
                            values[1],

                        eventCount:
                            1
                    }
                );
            }

            else {
                const state =
                    properties.get(
                        property
                    );

                state.after =
                    values[1];

                state.eventCount +=
                    1;
            }
        }
    }

    const netDelta = {};

    for (
        const [
            identity,
            properties
        ]
        of states
    ) {
        const identityDelta = {};

        for (
            const [
                property,
                state
            ]
            of properties
        ) {
            if (
                JSON.stringify(
                    state.before
                ) ===
                JSON.stringify(
                    state.after
                )
            ) {
                continue;
            }

            identityDelta[
                property
            ] = {
                before:
                    state.before,

                after:
                    state.after,

                eventCount:
                    state.eventCount
            };
        }

        if (
            Object.keys(
                identityDelta
            ).length > 0
        ) {
            netDelta[
                identity
            ] = identityDelta;
        }
    }

    return netDelta;
}


// --------------------------------------------------
// BUILD COMPACT SESSION ENTRIES
// --------------------------------------------------

function buildSessionEntries(
    session
) {
    const entries = [];

    const netDelta =
        session.netDelta || {};

    const events =
        session.events || [];

    const eventCounts =
        new Map();

    const eventTypes =
        new Map();

    for (
        const event
        of events
    ) {
        const identity =
            event.identity;

        eventCounts.set(
            identity,
            (
                eventCounts.get(
                    identity
                ) || 0
            ) + 1
        );

        if (
            !eventTypes.has(
                identity
            )
        ) {
            eventTypes.set(
                identity,
                event.type
            );
        }
    }

    const identities =
        new Set([
            ...eventTypes.keys(),
            ...Object.keys(
                netDelta
            )
        ]);

    for (
        const identity
        of identities
    ) {
        const type =
            eventTypes.get(
                identity
            ) || "changed";

        const significant =
            Boolean(
                session.significance &&
                session.significance.declarations &&
                session.significance.declarations.some(
                    declaration =>
                        declaration.identity ===
                        identity
                )
            );

        const identityNetDelta =
            netDelta[
                identity
            ] || {};

        if (
            type === "changed" &&
            Object.keys(
                identityNetDelta
            ).length === 0
        ) {
            continue;
        }

        entries.push({
            identity,

            type,

            netDelta:
                identityNetDelta,

            significant,

            eventCount:
                eventCounts.get(
                    identity
                ) || 0
        });
    }

    return entries;
}


// --------------------------------------------------
// SEAL
// --------------------------------------------------

export function sealSession(
    session,
    reason = "manual",
    meta = {}
) {
    if (
        session.sealed
    ) {
        return session;
    }

    const netDelta =
        calculateNetDelta(
            session.events
        );

    session.sealed =
        true;

    session.sealedAt =
        new Date().toISOString();

    session.sealedBy =
        reason;

    if (
        meta.commit
    ) {
        session.commit =
            meta.commit;
    }

    session.netDelta =
        netDelta;

    session.significance =
        analyzeSignificance({
            ...session,
            netDelta
        });

    /*
     * sessions.json stores only a compact derived summary.
     *
     * The complete event history remains in events.jsonl.
     * Declaration objects, source locations and line numbers
     * must never be duplicated into sessions.json.
     */

    session.entries =
        buildSessionEntries(
            session
        );

    delete session.events;

    return session;
}

// --------------------------------------------------
// SAVE
// --------------------------------------------------

export function saveSessions(
    projectRoot,
    sessions
) {
    const sessionsPath =
        getSessionsPath(
            projectRoot
        );

    const temporaryPath =
        `${sessionsPath}.tmp`;

    fs.writeFileSync(
        temporaryPath,
        JSON.stringify(
            sessions,
            null,
            2
        ) + "\n",
        "utf8"
    );

    fs.renameSync(
        temporaryPath,
        sessionsPath
    );
}


// --------------------------------------------------
// LOAD
// --------------------------------------------------

export function loadSessions(
    projectRoot
) {
    const sessionsPath =
        getSessionsPath(
            projectRoot
        );

    if (
        !fs.existsSync(
            sessionsPath
        )
    ) {
        return [];
    }

    const content =
        fs.readFileSync(
            sessionsPath,
            "utf8"
        );

    if (
        !content.trim()
    ) {
        return [];
    }

    try {
        const parsed =
            JSON.parse(
                content
            );

        if (
            !Array.isArray(
                parsed
            )
        ) {
            throw new Error(
                "sessions.json must contain an array."
            );
        }

        return parsed;
    }

    catch (error) {
        console.error(
            `Warning: sessions.json is corrupt and will be rebuilt: ${error.message}`
        );

        return [];
    }
}
