/*
 * ------------------------------------------------------------
 * CALLER INDEX
 * ------------------------------------------------------------
 *
 * Builds a reverse index from declaration call expressions.
 *
 * Declaration:
 *
 *     orders.ts::createOrder:function
 *         calls: ["loadSession"]
 *
 * Becomes:
 *
 *     loadSession -> [
 *         {
 *             caller:
 *                 "orders.ts::createOrder:function",
 *             confidence:
 *                 "inferred"
 *         }
 *     ]
 *
 * This layer intentionally does NOT resolve the callee to a
 * declaration identity. `calls` currently contains expression
 * text, not symbol identity.
 *
 * Resolution is handled by dependencies/resolver.js.
 * ------------------------------------------------------------
 */

function normalizeCalls(
    declaration
) {
    const calls =
        declaration?.properties?.calls;

    if (
        !Array.isArray(calls)
    ) {
        return [];
    }

    return [
        ...new Set(
            calls.filter(
                call =>
                    typeof call ===
                    "string" &&
                    call.length > 0
            )
        )
    ];
}


// ------------------------------------------------------------
// BUILD CALLER INDEX
// ------------------------------------------------------------

export function buildCallerIndex(
    declarations
) {
    const callers = {};

    for (
        const declaration
        of declarations || []
    ) {
        const caller =
            declaration?.identity;

        if (
            typeof caller !==
            "string" ||
            caller.length === 0
        ) {
            continue;
        }

        const calls =
            normalizeCalls(
                declaration
            );

        for (
            const callee
            of calls
        ) {
            if (
                !callers[callee]
            ) {
                callers[callee] = [];
            }

            /*
             * Avoid duplicate caller edges.
             */
            const alreadyExists =
                callers[callee].some(
                    edge =>
                        edge.caller ===
                        caller
                );

            if (
                alreadyExists
            ) {
                continue;
            }

            callers[callee].push({
                caller,
                confidence:
                    "inferred"
            });
        }
    }

    /*
     * Stable output makes tests and future graph
     * persistence deterministic.
     */
    for (
        const callee
        of Object.keys(
            callers
        )
    ) {
        callers[callee].sort(
            (left, right) =>
                left.caller.localeCompare(
                    right.caller
                )
        );
    }

    return callers;
}


// ------------------------------------------------------------
// IMPACT TRAVERSAL
// ------------------------------------------------------------
//
// Find declarations that may be affected by a changed
// callee.
//
// The traversal is intentionally depth-limited.
//
// depth = 1
//
//     verifyToken
//          ↑
//     loadSession
//
// depth = 2
//
//     verifyToken
//          ↑
//     loadSession
//          ↑
//     createOrder
//
// Every edge remains `inferred` until symbol resolution
// upgrades it.
// ------------------------------------------------------------

export function findCallers(
    callerIndex,
    callee,
    maxDepth = 1
) {
    if (
        !callerIndex ||
        typeof callee !== "string" ||
        callee.length === 0 ||
        maxDepth < 1
    ) {
        return [];
    }

    const results = [];
    const visited = new Set();

    function getLookupName(
        identity
    ) {
        /*
         * The caller index is currently keyed by
         * unresolved call names, while traversal
         * results contain full declaration identities.
         *
         * Example:
         *
         *     auth.ts::loadSession:function
         *
         * becomes:
         *
         *     loadSession
         */

        if (
            typeof identity !== "string"
        ) {
            return identity;
        }

        const withoutFile =
            identity.includes("::")
                ? identity.split("::").pop()
                : identity;

        return withoutFile
            .replace(
                /:(?:function|method|class|variable|interface|type|enum|property)(?:#\d+)?$/,
                ""
            );
    }

    function visit(
        identity,
        depth
    ) {
        if (
            depth >= maxDepth
        ) {
            return;
        }

        const lookupName =
            getLookupName(
                identity
            );

        const edges =
            callerIndex[
                lookupName
            ] || [];

        for (
            const edge
            of edges
        ) {
            if (
                visited.has(
                    edge.caller
                )
            ) {
                continue;
            }

            visited.add(
                edge.caller
            );

            const nextDepth =
                depth + 1;

            results.push({
                identity:
                    edge.caller,

                depth:
                    nextDepth,

                confidence:
                    edge.confidence
            });

            visit(
                edge.caller,
                nextDepth
            );
        }
    }

    visit(
        callee,
        0
    );

    return results;
}
import {
    resolveProjectImports
} from "./resolver.js";

for (
    const name
    of [
        "named",
        "default",
        "namespace",
        "cjs",
        "cjs-destructured",
        "reexport",
        "external",
        "missing"
    ]
) {
    console.log("\n==============================");
    console.log(name);
    console.log("==============================");

    const result =
        resolveProjectImports(
            `test/v0.5/deps/imports/${name}`
        );

    console.log(
        JSON.stringify(
            result.edges,
            null,
            2
        )
    );
}
