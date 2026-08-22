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
// SEAL
// --------------------------------------------------

export function sealSession(
    session
) {
    if (
        session.sealed
    ) {
        return session;
    }

    session.sealed =
        true;

    session.sealedAt =
        new Date().toISOString();

    session.netDelta =
        calculateNetDelta(
            session.events
        );

    session.significance =
        analyzeSignificance(
            session
        );

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
