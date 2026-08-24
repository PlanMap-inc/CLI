/*
 * ------------------------------------------------------------
 * DEPENDENCY GRAPH
 * ------------------------------------------------------------
 *
 * Converts the dependency relationships produced by the
 * resolver / caller index / join layer into one deterministic
 * graph representation.
 *
 * The graph is intentionally a data layer.
 * It does not perform resolution itself.
 *
 * Output:
 *
 * {
 *     nodes: [...],
 *     edges: [...]
 * }
 *
 * Nodes represent declarations/files.
 * Edges represent relationships such as:
 *
 *     call
 *     import
 *     reexport
 *     namespace
 *     commonjs
 *
 * ------------------------------------------------------------
 */


/*
 * ------------------------------------------------------------
 * NODE ID
 * ------------------------------------------------------------
 */

function nodeId(
    declaration
) {
    return (
        declaration?.identity ||
        declaration?.id ||
        null
    );
}


/*
 * ------------------------------------------------------------
 * ADD NODE
 * ------------------------------------------------------------
 */

function addNode(
    nodes,
    seen,
    declaration
) {
    const id =
        nodeId(
            declaration
        );

    if (
        typeof id !== "string" ||
        id.length === 0 ||
        seen.has(id)
    ) {
        return;
    }

    seen.add(id);

    nodes.push({
        id,

        kind:
            declaration.kind ||
            "unknown",

        name:
            declaration.name ||
            null,

        file:
            declaration.file ||
            null
    });
}


/*
 * ------------------------------------------------------------
 * NORMALIZE EDGE
 * ------------------------------------------------------------
 */

function normalizeEdge(
    edge
) {
    if (
        !edge ||
        typeof edge.from !== "string" ||
        edge.from.length === 0
    ) {
        return null;
    }

    if (
        typeof edge.to !== "string" ||
        edge.to.length === 0
    ) {
        return null;
    }

    return {
        from:
            edge.from,

        to:
            edge.to,

        kind:
            edge.kind ||
            "unknown",

        confidence:
            edge.confidence ||
            "unresolved"
    };
}


/*
 * ------------------------------------------------------------
 * EDGE KEY
 * ------------------------------------------------------------
 *
 * Used to remove duplicate relationships while preserving
 * different relationship kinds/confidence levels.
 * ------------------------------------------------------------
 */

function edgeKey(
    edge
) {
    return [
        edge.from,
        edge.to,
        edge.kind,
        edge.confidence
    ].join("|");
}


/*
 * ------------------------------------------------------------
 * SORT NODES
 * ------------------------------------------------------------
 */

function sortNodes(
    nodes
) {
    nodes.sort(
        (left, right) =>
            left.id.localeCompare(
                right.id
            )
    );

    return nodes;
}


/*
 * ------------------------------------------------------------
 * SORT EDGES
 * ------------------------------------------------------------
 */

function sortEdges(
    edges
) {
    edges.sort(
        (left, right) => {
            const from =
                left.from.localeCompare(
                    right.from
                );

            if (
                from !== 0
            ) {
                return from;
            }

            const to =
                left.to.localeCompare(
                    right.to
                );

            if (
                to !== 0
            ) {
                return to;
            }

            const kind =
                left.kind.localeCompare(
                    right.kind
                );

            if (
                kind !== 0
            ) {
                return kind;
            }

            return left.confidence.localeCompare(
                right.confidence
            );
        }
    );

    return edges;
}


/*
 * ------------------------------------------------------------
 * BUILD GRAPH
 * ------------------------------------------------------------
 *
 * declarations:
 *     scanner declarations
 *
 * dependencyEdges:
 *     resolver / join edges
 *
 * callerIndex:
 *     reverse caller index
 *
 * The function accepts missing inputs so callers can construct
 * partial graphs safely.
 * ------------------------------------------------------------
 */

export function buildGraph({
    declarations = [],
    dependencyEdges = []
} = {}) {
    const nodes = [];
    const nodeSet = new Set();

    /*
     * --------------------------------------------------------
     * DECLARATION NODES
     * --------------------------------------------------------
     */

    for (
        const declaration
        of declarations
    ) {
        addNode(
            nodes,
            nodeSet,
            declaration
        );
    }


    /*
     * --------------------------------------------------------
     * DEPENDENCY EDGES
     * --------------------------------------------------------
     */

    const edges = [];
    const edgeSet = new Set();

    function addEdge(
        candidate
    ) {
        const edge =
            normalizeEdge(
                candidate
            );

        if (
            !edge
        ) {
            return;
        }

        const key =
            edgeKey(
                edge
            );

        if (
            edgeSet.has(key)
        ) {
            return;
        }

        edgeSet.add(key);
        edges.push(edge);
    }


    for (
        const edge
        of dependencyEdges
    ) {
        addEdge(
            edge
        );
    }


    sortNodes(
        nodes
    );

    sortEdges(
        edges
    );

    return {
        nodes,
        edges
    };
}
