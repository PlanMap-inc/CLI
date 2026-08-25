import fs from "node:fs";
import path from "node:path";

import {
    runCheck,
    readBaseline
} from "../check.js";

import {
    scanProject
} from "../scanner.js";

import {
    parseFile
} from "../parser.js";

import {
    diffDeclarations,
    formatDiff
} from "../diff.js";

import {
    calculateNetDelta
} from "../sessions.js";

import {
    analyzeSignificance
} from "../evolution/significance.js";

import {
    loadConfig
} from "../config.js";


import {
    resolveProjectImports
} from "../dependencies/resolver.js";

import {
    buildCallerIndex
} from "../dependencies/callers.js";

import {
    joinDependencies
} from "../dependencies/join.js";

import {
    buildGraph
} from "../dependencies/graph.js";

import {
    findImpact
} from "../dependencies/impact.js";

// --------------------------------------------------
// BUILD SIGNIFICANCE SESSION
// --------------------------------------------------

function buildSignificanceSession(
    changes,
    config
) {
    const events = [];

    for (
        const change
        of changes
    ) {
        if (
            change.type === "unchanged"
        ) {
            continue;
        }

        const delta = {};

        for (
            const propertyChange
            of change.changes || []
        ) {
            delta[propertyChange.property] = [
                propertyChange.before,
                propertyChange.after
            ];
        }

        events.push({
            identity:
                change.identity,

            type:
                change.type,

            delta
        });
    }

    const netDelta =
        calculateNetDelta(
            events
        );

    return {
        events,
        netDelta,
        config
    };
}


// --------------------------------------------------
// RUN PROJECT CHECK
// --------------------------------------------------

export function runProjectCheck(
    projectPath,
    options = {}
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js check <project-folder> [--all]"
        );

        process.exitCode = 1;
        return;
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (
        !fs.existsSync(
            projectRoot
        )
    ) {
        console.error(
            `Project folder not found: ${projectPath}`
        );

        process.exitCode = 1;
        return;
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {
        console.error(
            `Project path is not a folder: ${projectPath}`
        );

        process.exitCode = 1;
        return;
    }

    console.log(
        `\nChecking project: ${projectRoot}\n`
    );

    const changes =
        runCheck(
            projectRoot,
            scanProject,
            parseFile,
            diffDeclarations
        );

    const realChanges =
        changes.filter(
            change =>
                change.type !== "unchanged"
        );

    if (
        realChanges.length === 0
    ) {
        console.log(
            "No changes detected."
        );

        process.exitCode = 0;
        return;
    }

    const config =
        loadConfig(
            projectRoot
        );

    const session =
        buildSignificanceSession(
            changes,
            config
        );

    const significance =
        analyzeSignificance(
            session
        );

    const significantIds =
        new Set(
            significance.declarations.map(
                declaration =>
                    declaration.identity
            )
        );

    const significantChanges =
        realChanges.filter(
            change =>
                significantIds.has(
                    change.identity
                )
        );

    const insignificantChanges =
        realChanges.filter(
            change =>
                !significantIds.has(
                    change.identity
                )
        );

    let impactGraph = null;

    if (
        significantChanges.length > 0
    ) {
        const declarations =
            scanProject(
                projectRoot
            );

        const resolved =
            resolveProjectImports(
                projectRoot
            );

        const callerIndex =
            buildCallerIndex(
                declarations
            );

        let joined =
            joinDependencies(
                resolved,
                callerIndex,
                declarations
            );

        /*
         * Deleted declarations no longer exist in the current
         * declaration set. Caller analysis can therefore retain
         * their target only as a bare symbol name.
         *
         * Re-anchor those unresolved caller edges to the
         * deleted declaration's baseline identity so reverse
         * impact analysis can still find its live callers.
         *
         * We deliberately preserve the original confidence.
         * The target identity is recovered from the baseline,
         * but the relationship itself was not resolved against
         * a current declaration.
         */
        const deletedChanges =
            significantChanges.filter(
                change =>
                    change.type === "deleted"
            );

        if (
            deletedChanges.length > 0
        ) {
            joined =
                joined.map(
                    edge => {
                        if (
                            edge?.to === null ||
                            typeof edge?.to !== "string"
                        ) {
                            return edge;
                        }

                        const deleted =
                            deletedChanges.find(
                                change =>
                                    change.identity
                                        .split("::")[1]
                                        ?.split("#")[0]
                                        ?.split(":")[0] ===
                                    edge.to
                            );

                        if (
                            !deleted
                        ) {
                            return edge;
                        }

                        return {
                            ...edge,
                            to:
                                deleted.identity
                        };
                    }
                );
        }

        /*
         * Include baseline declarations so deleted targets remain
         * valid graph identities during this check.
         */
        const baseline =
            readBaseline(
                projectRoot
            );

        const baselineDeclarations =
            Array.isArray(
                baseline?.declarations
            )
                ? baseline.declarations
                : [];

        const declarationMap =
            new Map();

        for (
            const declaration
            of [
                ...baselineDeclarations,
                ...declarations
            ]
        ) {
            if (
                typeof declaration?.identity !==
                    "string"
            ) {
                continue;
            }

            declarationMap.set(
                declaration.identity,
                declaration
            );
        }

        impactGraph =
            buildGraph({
                declarations:
                    Array.from(
                        declarationMap.values()
                    ),

                dependencyEdges:
                    joined
            });
    }

    console.log(
        "\nPlanMap Check\n"
    );

    console.log(
        `Changes: ${realChanges.length}`
    );

    console.log(
        `Significant: ${significantChanges.length}`
    );

    console.log(
        `Insignificant: ${insignificantChanges.length}`
    );

    if (
        significantChanges.length > 0
    ) {
        console.log(
            "\nSignificant changes:\n"
        );

        formatDiff(
            significantChanges,
            "baseline",
            "current"
        );
    }

    if (
        significantChanges.length > 0 &&
        impactGraph
    ) {
        console.log(
            "\nImpact analysis:\n"
        );

        for (
            const change
            of significantChanges
        ) {
            const impact =
                findImpact(
                    impactGraph,
                    change.identity
                );

            console.log(
                `\n${change.identity}`
            );

            if (
                impact.affected.length === 0
            ) {
                console.log(
                    "  No affected declarations found."
                );
            } else {
                for (
                    const affected
                    of impact.affected
                ) {
                    console.log(
                        `  depth ${affected.depth}  ` +
                        `${affected.identity}  ` +
                        `[${affected.kind}/${affected.confidence}]`
                    );
                }
            }

            if (
                impact.unresolved > 0
            ) {
                console.log(
                    `  unresolved graph edges: ` +
                    `${impact.unresolved}`
                );
            }

            if (
                impact.truncated
            ) {
                console.log(
                    "  impact results truncated."
                );
            }
        }
    }

    if (
        options.all &&
        insignificantChanges.length > 0
    ) {
        console.log(
            "\nInsignificant changes:\n"
        );

        formatDiff(
            insignificantChanges,
            "baseline",
            "current"
        );
    }

    /*
     * Normal check fails only when a meaningful
     * semantic change exists.
     *
     * --all changes display only.
     */
    process.exitCode =
        significantChanges.length > 0
            ? 1
            : 0;
}
