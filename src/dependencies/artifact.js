import fs from "node:fs";
import path from "node:path";


/*
 * ------------------------------------------------------------
 * WRITE GRAPH ARTIFACT
 * ------------------------------------------------------------
 *
 * graph.json is a derived artifact.
 *
 * It can always be deleted and regenerated from the source
 * code. It is therefore intentionally kept outside the core
 * dependency calculation.
 * ------------------------------------------------------------
 */

export function writeGraphArtifact(
    projectRoot,
    graph
) {
    const absoluteRoot =
        path.resolve(
            projectRoot
        );

    const planmapDirectory =
        path.join(
            absoluteRoot,
            ".planmap"
        );

    const graphPath =
        path.join(
            planmapDirectory,
            "graph.json"
        );

    fs.mkdirSync(
        planmapDirectory,
        {
            recursive: true
        }
    );

    const normalizedGraph = {
        nodes:
            Array.isArray(
                graph?.nodes
            )
                ? graph.nodes
                : [],

        edges:
            Array.isArray(
                graph?.edges
            )
                ? graph.edges
                : []
    };

    const serialized =
        JSON.stringify(
            normalizedGraph,
            null,
            2
        ) + "\n";

    fs.writeFileSync(
        graphPath,
        serialized,
        "utf8"
    );

    return graphPath;
}


/*
 * ------------------------------------------------------------
 * READ GRAPH ARTIFACT
 * ------------------------------------------------------------
 */

export function readGraphArtifact(
    projectRoot
) {
    const graphPath =
        path.join(
            path.resolve(
                projectRoot
            ),
            ".planmap",
            "graph.json"
        );

    return JSON.parse(
        fs.readFileSync(
            graphPath,
            "utf8"
        )
    );
}
