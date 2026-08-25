import { scanProject } from "../../src/scanner.js";
import { resolveProjectImports } from "../../src/dependencies/resolver.js";
import { buildCallerIndex } from "../../src/dependencies/callers.js";
import { joinDependencies } from "../../src/dependencies/join.js";
import { buildGraph } from "../../src/dependencies/graph.js";
import { findImpact } from "../../src/dependencies/impact.js";

const root = process.cwd();

const declarations =
    scanProject(root);

const resolved =
    resolveProjectImports(root);

const callerIndex =
    buildCallerIndex(
        declarations
    );

const joined =
    joinDependencies(
        resolved,
        callerIndex,
        declarations
    );

const graph =
    buildGraph({
        declarations,
        dependencyEdges:
            joined
    });

const target =
    "src/properties.js::extractProperties:function";

const incoming =
    graph.edges.filter(
        edge =>
            edge.to === target
    );

const impact =
    findImpact(
        graph,
        target
    );

console.log(
    "=== GRAPH ==="
);

console.log(
    JSON.stringify(
        {
            declarations:
                declarations.length,

            joinedEdges:
                joined.length,

            graphNodes:
                graph.nodes.length,

            graphEdges:
                graph.edges.length
        },
        null,
        2
    )
);

console.log(
    "=== EDGES INTO TARGET ==="
);

console.log(
    JSON.stringify(
        incoming,
        null,
        2
    )
);

console.log(
    "=== IMPACT ==="
);

console.log(
    JSON.stringify(
        impact,
        null,
        2
    )
);
