/*
 * ------------------------------------------------------------
 * IMPACT ANALYSIS
 * ------------------------------------------------------------
 *
 * Walks the canonical dependency graph backwards.
 *
 * Graph:
 *
 *     caller
 *        |
 *        v
 *     target
 *
 * Impact analysis:
 *
 *     target
 *        ^
 *        |
 *     caller
 *
 * The target is depth 0.
 * A direct dependency is depth 1.
 *
 * Unresolved edges are retained by the graph but cannot be
 * traversed because their target is null.
 * ------------------------------------------------------------
 */


/*
 * ------------------------------------------------------------
 * DEFAULTS
 * ------------------------------------------------------------
 */

const DEFAULT_MAX_DEPTH =
    3;

const DEFAULT_MAX_RESULTS =
    25;


/*
 * ------------------------------------------------------------
 * FIND IMPACT
 * ------------------------------------------------------------
 */

export function findImpact(
    graph = {},
    target,
    options = {}
) {
    const maxDepth =
        Number.isInteger(
            options.maxDepth
        )
            ? Math.max(
                0,
                options.maxDepth
            )
            : DEFAULT_MAX_DEPTH;

    const maxResults =
        Number.isInteger(
            options.maxResults
        )
            ? Math.max(
                0,
                options.maxResults
            )
            : DEFAULT_MAX_RESULTS;

    if (
        typeof target !== "string" ||
        target.length === 0
    ) {
        return {
            target:
                target ?? null,

            affected:
                [],

            unresolved:
                0,

            truncated:
                false
        };
    }

    const edges =
        Array.isArray(
            graph.edges
        )
            ? graph.edges
            : [];

    /*
     * Reverse adjacency:
     *
     *     target -> incoming edges
     *
     * Original edge:
     *
     *     from -> to
     *
     * Reverse lookup:
     *
     *     to -> from
     */

    const incoming =
        new Map();

    let unresolved =
        0;

    for (
        const edge
        of edges
    ) {
        if (
            edge?.to === null
        ) {
            unresolved++;
            continue;
        }

        if (
            typeof edge?.from !==
                "string" ||
            typeof edge?.to !==
                "string"
        ) {
            continue;
        }

        if (
            !incoming.has(
                edge.to
            )
        ) {
            incoming.set(
                edge.to,
                []
            );
        }

        incoming
            .get(edge.to)
            .push(edge);
    }


    /*
     * The graph is already deterministic, but sort the
     * incoming lists here so Impact Analysis remains
     * deterministic even when handed an unsorted graph.
     */

    for (
        const list
        of incoming.values()
    ) {
        list.sort(
            (left, right) => {
                const leftKey =
                    [
                        left.from,
                        left.kind,
                        left.confidence
                    ].join("|");

                const rightKey =
                    [
                        right.from,
                        right.kind,
                        right.confidence
                    ].join("|");

                return leftKey.localeCompare(
                    rightKey
                );
            }
        );
    }


    /*
     * --------------------------------------------------------
     * BREADTH-FIRST REVERSE WALK
     * --------------------------------------------------------
     */

    const affected =
        [];

    const visited =
        new Set([
            target
        ]);

    const queue =
        [
            {
                identity:
                    target,

                depth:
                    0
            }
        ];

    let truncated =
        false;

    while (
        queue.length > 0
    ) {
        const current =
            queue.shift();

        if (
            current.depth >=
            maxDepth
        ) {
            continue;
        }

        const callers =
            incoming.get(
                current.identity
            ) || [];

        for (
            let index = 0;
            index < callers.length;
            index++
        ) {
            const edge =
                callers[index];

            const identity =
                edge.from;

            if (
                visited.has(
                    identity
                )
            ) {
                continue;
            }

            visited.add(
                identity
            );

            const depth =
                current.depth + 1;

            affected.push({
                identity,

                depth,

                kind:
                    edge.kind,

                confidence:
                    edge.confidence
            });

            /*
             * Keep the newly discovered node in the BFS
             * frontier before checking the result cap.
             *
             * This is important because the node itself may
             * lead to additional impacts.
             */
            if (
                depth <
                maxDepth
            ) {
                queue.push({
                    identity,

                    depth
                });
            }

            if (
                affected.length >=
                maxResults
            ) {
                /*
                 * We have reached the result cap.
                 *
                 * There is more work if:
                 *
                 * 1. another caller remains on the current
                 *    node, or
                 *
                 * 2. a newly discovered node remains queued.
                 *
                 * Both cases mean the caller would receive an
                 * incomplete impact set.
                 */
                const remainingCallers =
                    callers
                        .slice(
                            index + 1
                        )
                        .some(
                            remaining =>
                                !visited.has(
                                    remaining.from
                                )
                        );

                truncated =
                    remainingCallers ||
                    queue.length > 0;

                break;
            }
        }

        if (
            affected.length >=
            maxResults
        ) {
            break;
        }
    }


    /*
     * Deterministic presentation.
     *
     * Depth is the primary traversal information.
     * Identity makes output stable.
     */

    affected.sort(
        (left, right) => {
            if (
                left.depth !==
                right.depth
            ) {
                return (
                    left.depth -
                    right.depth
                );
            }

            return left.identity.localeCompare(
                right.identity
            );
        }
    );

    return {
        target,

        affected,

        unresolved,

        truncated
    };
}
