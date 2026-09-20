// --------------------------------------------------
// THE IN-PROJECT CALL GRAPH
// --------------------------------------------------
// Which declaration calls which, worked out from facts the scanner already
// records. The walkers note every call a declaration makes by name; this
// matches those names back against the project's own declarations and throws
// away everything that lands outside it.
//
// Two things need it.
//
// EDGES. A feature's steps used to be chained in the order the model
// numbered them - 178 edges over 179 nodes in one measured project, a single
// unbranching line per feature. Half of those arrows asserted an order the
// code does not have: four risk lookups drawn as if one led to the next when
// they are siblings. An edge drawn from a real call is evidence; the rest of
// the steps are a set, and drawing them as a set says so.
//
// ROLES. A helper is recognisable by being called from several places while
// deciding nothing itself, and that first half is only visible from here.
//
// WHAT IT IS NOT. This is name matching over static facts, not resolution.
// A call to an imported function of the same name as a local one is
// ambiguous, and ambiguity is dropped rather than guessed: a missing edge
// leaves two steps side by side, which is merely less specific, while a
// wrong edge tells the reader something untrue.
// --------------------------------------------------

import { declarationName } from "../llm/roles.js";

// A call fact is written as it appears in the source: "get_store",
// "s.agency_risk_for_scope", "df[\"agency\"].str.casefold". The callee's own
// name is the last segment, and the receiver in front of it says where it
// was reached from rather than what it is.
function callTargets(
    call
) {
    if (
        typeof call !== "string"
    ) {
        return [];
    }

    const text =
        call.trim();

    if (!text) {
        return [];
    }

    // Subscripts carry no name and split the receiver in ways the last
    // segment should not inherit: df["agency"].str.casefold -> casefold.
    const cleaned =
        text.replace(
            /\[[^\]]*\]/g,
            ""
        );

    const segments =
        cleaned
            .split(".")
            .map(part => part.trim())
            .filter(Boolean);

    if (
        segments.length === 0
    ) {
        return [];
    }

    const last =
        segments[segments.length - 1];

    // The whole dotted name first, so "Store.agency_risk_for_scope" matches a
    // method recorded under exactly that name before the bare segment is
    // tried and matches every same-named method in the project.
    const candidates =
        segments.length > 1
            ? [cleaned, `${segments[segments.length - 2]}.${last}`, last]
            : [last];

    return [
        ...new Set(
            candidates.filter(Boolean)
        )
    ];
}


// --------------------------------------------------
// BUILD
// --------------------------------------------------
// Returns callers and callees keyed by identity, plus the caller COUNT that
// role proposal reads. Every map is complete: a declaration nothing calls is
// present with an empty list, so a reader of this never has to tell "no
// callers" apart from "not indexed".
// --------------------------------------------------

export function buildCallGraph(
    declarations
) {
    const list =
        Array.isArray(declarations)
            ? declarations.filter(Boolean)
            : [];

    // name -> identities. Both the full name and the bare last segment, so a
    // method is reachable as "Store.load" and as "load".
    const byName =
        new Map();

    const add = (
        name,
        identity
    ) => {
        if (!name) {
            return;
        }

        if (
            !byName.has(name)
        ) {
            byName.set(
                name,
                new Set()
            );
        }

        byName
            .get(name)
            .add(identity);
    };

    for (
        const declaration of list
    ) {
        const identity =
            declaration.identity;

        if (
            typeof identity !== "string"
        ) {
            continue;
        }

        const name =
            declarationName(identity);

        add(
            name,
            identity
        );

        const bare =
            name.split(".").pop();

        if (
            bare &&
            bare !== name
        ) {
            add(
                bare,
                identity
            );
        }
    }

    const fileOf =
        new Map(
            list
                .filter(
                    declaration =>
                        typeof declaration.identity === "string"
                )
                .map(
                    declaration => [
                        declaration.identity,
                        declaration.file ||
                            declaration.identity.split("::")[0]
                    ]
                )
        );

    const callees =
        new Map();

    const callers =
        new Map();

    for (
        const declaration of list
    ) {
        if (
            typeof declaration.identity === "string"
        ) {
            callees.set(
                declaration.identity,
                new Set()
            );

            callers.set(
                declaration.identity,
                new Set()
            );
        }
    }

    for (
        const declaration of list
    ) {
        const from =
            declaration.identity;

        if (
            typeof from !== "string"
        ) {
            continue;
        }

        const calls =
            declaration.properties?.calls;

        const callbacks =
            declaration.properties?.callbacks;

        // A callback registration is not an invocation, but it is just as
        // real a "this leads to that" relationship for the graph's purposes -
        // handing a function reference to something else is how the caller
        // arranges for it to run later. Folded into the same edges a direct
        // call produces; kept as its own fact (properties.callbacks, never
        // merged into properties.calls) so a reading built from the facts
        // never claims an invocation that isn't there.
        const targets =
            [
                ...(Array.isArray(calls) ? calls : []),
                ...(Array.isArray(callbacks) ? callbacks : [])
            ];

        if (
            targets.length === 0
        ) {
            continue;
        }

        for (
            const call of targets
        ) {
            const target =
                resolve(
                    call,
                    from,
                    byName,
                    fileOf
                );

            if (
                !target ||
                target === from
            ) {
                continue;
            }

            callees
                .get(from)
                .add(target);

            callers
                .get(target)
                .add(from);
        }
    }

    const callerCount =
        new Map(
            [...callers].map(
                ([identity, set]) => [
                    identity,
                    set.size
                ]
            )
        );

    return {
        callees,
        callers,
        callerCount,

        // The edge list, for anything that wants to walk it directly.
        edges: [
            ...callees
        ].flatMap(
            ([from, targets]) =>
                [...targets].map(
                    to => ({
                        from,
                        to
                    })
                )
        )
    };
}


// One call name to one identity, or null. Ambiguity resolves to a same-file
// declaration when there is exactly one, because a bare call inside a file
// most often means that file's own function; otherwise it is dropped.
function resolve(
    call,
    from,
    byName,
    fileOf
) {
    for (
        const candidate of callTargets(call)
    ) {
        const matches =
            byName.get(candidate);

        if (
            !matches ||
            matches.size === 0
        ) {
            continue;
        }

        if (
            matches.size === 1
        ) {
            return [...matches][0];
        }

        const here =
            fileOf.get(from);

        const sameFile =
            [...matches].filter(
                identity =>
                    fileOf.get(identity) === here
            );

        if (
            sameFile.length === 1
        ) {
            return sameFile[0];
        }

        // Named, but it could be any of several. Say nothing.
        return null;
    }

    return null;
}
