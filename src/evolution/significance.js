const ALWAYS_SIGNIFICANT = new Set([
    "throws",
    "throwTypes",
    "returns",
    "returnsNullish",
    "catches",
    "emptyCatches",
    "params",
    "awaits"
]);

const NOISE_CALL_PREFIXES = [
    "console.",
    "logger.",
    "debug."
];

function isNoiseCall(call) {
    if (typeof call !== "string") {
        return false;
    }

    return NOISE_CALL_PREFIXES.some(
        prefix =>
            call === prefix ||
            call.startsWith(prefix)
    );
}

function changedValues(before, after) {
    return (
        JSON.stringify(before) !==
        JSON.stringify(after)
    );
}

function callsOnlyContainNoise(before, after) {
    const oldCalls =
        Array.isArray(before)
            ? before
            : [];

    const newCalls =
        Array.isArray(after)
            ? after
            : [];

    const removed =
        oldCalls.filter(
            call =>
                !newCalls.includes(call)
        );

    const added =
        newCalls.filter(
            call =>
                !oldCalls.includes(call)
        );

    return [
        ...removed,
        ...added
    ].every(
        isNoiseCall
    );
}

function isPropertySignificant(
    property,
    change
) {
    const before =
        change.before;

    const after =
        change.after;

    if (
        !changedValues(
            before,
            after
        )
    ) {
        return false;
    }

    if (
        ALWAYS_SIGNIFICANT.has(
            property
        )
    ) {
        return true;
    }

    if (
        property === "numbers"
    ) {
        return true;
    }

    if (
        property === "calls"
    ) {
        return !callsOnlyContainNoise(
            before,
            after
        );
    }

    return false;
}


// --------------------------------------------------
// ANALYZE SESSION SIGNIFICANCE
// --------------------------------------------------

export function analyzeSignificance(
    session
) {
    const reasons = [];
    const declarations = [];

    for (
        const event
        of session.events || []
    ) {
        if (
            event.type === "added" ||
            event.type === "deleted"
        ) {
            declarations.push({
                identity:
                    event.identity,

                type:
                    event.type
            });
        }
    }

    for (
        const [
            identity,
            properties
        ]
        of Object.entries(
            session.netDelta || {}
        )
    ) {
        for (
            const [
                property,
                change
            ]
            of Object.entries(
                properties
            )
        ) {
            if (
                isPropertySignificant(
                    property,
                    change
                )
            ) {
                reasons.push({
                    identity,
                    property,
                    before:
                        change.before,
                    after:
                        change.after,
                    eventCount:
                        change.eventCount
                });
            }
        }
    }

    return {
        significant:
            declarations.length > 0 ||
            reasons.length > 0,

        reasons,

        declarations
    };
}
