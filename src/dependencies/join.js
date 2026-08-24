/*
 * ------------------------------------------------------------
 * DEPENDENCY JOIN
 * ------------------------------------------------------------
 *
 * Combines resolver import edges with declaration-level
 * caller edges without inventing declaration relationships.
 *
 * Resolver edges:
 *
 *     consumer.ts
 *          |
 *          | import / certain
 *          v
 *     source.ts::validate:function
 *
 * Caller edges:
 *
 *     loadSession
 *          |
 *          | call / inferred
 *          v
 *     verifyToken
 *
 * The resolver currently knows the importing file, but does
 * not know which declaration contains the import usage.
 *
 * Therefore this layer preserves resolver edges as file/import
 * relationships and caller edges as declaration/call
 * relationships.
 *
 * No declaration-level import edge is fabricated.
 * ------------------------------------------------------------
 */


/*
 * ------------------------------------------------------------
 * NORMALIZE CALLER EDGES
 * ------------------------------------------------------------
 */

function normalizeCallerEdges(
    callerIndex
) {
    const edges = [];

    for (
        const callee
        of Object.keys(
            callerIndex || {}
        ).sort()
    ) {
        const callers =
            callerIndex[callee] || [];

        for (
            const edge
            of callers
        ) {
            if (
                typeof edge?.caller !==
                "string"
            ) {
                continue;
            }

            edges.push({
                from:
                    edge.caller,

                to:
                    callee,

                kind:
                    "call",

                confidence:
                    edge.confidence ||
                    "inferred"
            });
        }
    }

    return edges;
}


/*
 * ------------------------------------------------------------
 * NORMALIZE RESOLVER EDGES
 * ------------------------------------------------------------
 */

function normalizeResolverEdges(
    resolverResult
) {
    return [
        ...(
            resolverResult?.edges ||
            []
        )
    ]
        .filter(
            edge =>
                edge &&
                typeof edge.from ===
                    "string"
        )
        .map(
            edge => ({
                from:
                    edge.from,

                to:
                    edge.to ?? null,

                kind:
                    edge.kind ||
                    "import",

                confidence:
                    edge.confidence ||
                    "unresolved",

                reason:
                    edge.reason
            })
        );
}


/*
 * ------------------------------------------------------------
 * BUILD JOINED DEPENDENCIES
 * ------------------------------------------------------------
 *
 * Returns one deterministic relationship list.
 *
 * Import edges are retained exactly at the resolver's
 * granularity.
 *
 * Call edges are retained at declaration granularity.
 * ------------------------------------------------------------
 */

export function joinDependencies(
    resolverResult,
    callerIndex
) {
    const importEdges =
        normalizeResolverEdges(
            resolverResult
        );

    const callEdges =
        normalizeCallerEdges(
            callerIndex
        );

    const edges = [
        ...importEdges,
        ...callEdges
    ];

    edges.sort(
        (left, right) => {
            const leftKey =
                [
                    left.from,
                    left.to ?? "",
                    left.kind,
                    left.confidence
                ].join("|");

            const rightKey =
                [
                    right.from,
                    right.to ?? "",
                    right.kind,
                    right.confidence
                ].join("|");

            return leftKey.localeCompare(
                rightKey
            );
        }
    );

    return edges;
}


/*
 * ------------------------------------------------------------
 * DECLARATION FILE INDEX
 * ------------------------------------------------------------
 *
 * Useful for future symbol-aware joining.
 *
 * This deliberately does not resolve anything by itself.
 * ------------------------------------------------------------
 */

export function buildDeclarationFileIndex(
    declarations
) {
    const index = {};

    for (
        const declaration
        of declarations || []
    ) {
        const file =
            declaration?.file;

        const identity =
            declaration?.identity;

        if (
            typeof file !==
                "string" ||
            typeof identity !==
                "string"
        ) {
            continue;
        }

        if (
            !index[file]
        ) {
            index[file] = [];
        }

        index[file].push(
            identity
        );
    }

    for (
        const file
        of Object.keys(index)
    ) {
        index[file].sort(
            (left, right) =>
                left.localeCompare(
                    right
                )
        );
    }

    return index;
}
