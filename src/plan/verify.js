import {
    readPlan
} from "./storage.js";

import {
    readBaseline
} from "../check.js";

import {
    scanProject
} from "../scanner.js";

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

import {
    evaluateClause
} from "./evaluate.js";


function getDeclarationMap(
    baselineDeclarations,
    currentDeclarations
) {
    const map = new Map();

    for (
        const declaration
        of [
            ...baselineDeclarations,
            ...currentDeclarations
        ]
    ) {
        if (
            typeof declaration?.identity !==
                "string"
        ) {
            continue;
        }

        map.set(
            declaration.identity,
            declaration
        );
    }

    return map;
}


function buildImpactGraph(
    projectRoot,
    baselineDeclarations,
    currentDeclarations
) {
    const declarationMap =
        getDeclarationMap(
            baselineDeclarations,
            currentDeclarations
        );

    const declarations =
        Array.from(
            declarationMap.values()
        );

    const resolved =
        resolveProjectImports(
            projectRoot
        );

    const callerIndex =
        buildCallerIndex(
            currentDeclarations
        );

    let dependencyEdges =
        joinDependencies(
            resolved,
            callerIndex,
            currentDeclarations
        );

    const currentIdentities =
        new Set(
            currentDeclarations
                .map(
                    declaration =>
                        declaration?.identity
                )
                .filter(
                    identity =>
                        typeof identity === "string"
                )
        );

    const deletedChanges =
        baselineDeclarations.filter(
            declaration =>
                typeof declaration?.identity ===
                    "string" &&
                !currentIdentities.has(
                    declaration.identity
                )
        );

    if (
        deletedChanges.length > 0
    ) {
        dependencyEdges =
            dependencyEdges.map(
                edge => {
                    if (
                        edge?.to === null ||
                        typeof edge?.to !== "string"
                    ) {
                        return edge;
                    }

                    const deleted =
                        deletedChanges.find(
                            declaration =>
                                declaration.identity
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

    return buildGraph({
        declarations,
        dependencyEdges
    });
}

function isApproved(
    node
) {
    return node?.status === "approved";
}


function hasIdentity(
    node
) {
    return (
        typeof node?.identity === "string" &&
        node.identity.length > 0
    );
}


function evaluateBehaviourRules(
    node,
    declaration
) {
    const violations = [];
    const errors = [];

    const facts =
        declaration?.properties;

    const approvedFacts =
        node?.approvedFacts;

    for (
        const rule
        of Array.isArray(node?.rules)
            ? node.rules
            : []
    ) {
        if (
            rule?.kind !== "behaviour"
        ) {
            continue;
        }

        if (
            !rule.assert ||
            typeof rule.assert !== "object"
        ) {
            continue;
        }

        for (
            const [
                field,
                clause
            ] of Object.entries(
                rule.assert
            )
        ) {
            const result =
                evaluateClause(
                    field,
                    clause,
                    facts,
                    approvedFacts
                );

            if (
                result.error
            ) {
                errors.push({
                    target:
                        rule.target ?? null,

                    field,

                    message:
                        result.error
                });

                continue;
            }

            if (
                result.pass === false
            ) {
                violations.push({
                    target:
                        rule.target ?? null,

                    field,

                    actual:
                        result.actual,

                    expected:
                        result.expected,

                    reason:
                        result.reason
                });
            }
        }
    }

    return {
        violations,
        errors
    };
}


function evaluateStructureRules(
    node
) {
    const unsupported = [];

    for (
        const rule
        of Array.isArray(node?.rules)
            ? node.rules
            : []
    ) {
        if (
            rule?.kind !== "structure"
        ) {
            continue;
        }

        unsupported.push({
            target:
                rule.target ?? null,

            reason:
                "structure rules are not supported by Layer 5 verification"
        });
    }

    return unsupported;
}


function createResult(
    node,
    plan,
    status,
    extra = {}
) {
    return {
        identity:
            node?.identity ?? null,

        planNodeId:
            node?.id ??
            node?.nodeId ??
            null,

        planVersion:
            node?.version ??
            plan?.version ??
            1,

        status,

        lensTags:
            Array.isArray(node?.lensTags)
                ? node.lensTags
                : [],

        intent:
            node?.intent ?? null,

        approvedBy:
            node?.approvedBy ?? null,

        approvedAt:
            node?.approvedAt ?? null,

        violations:
            extra.violations ?? [],

        errors:
            extra.errors ?? [],

        unsupported:
            extra.unsupported ?? [],

        impact:
            extra.impact ?? []
    };
}


export function verifyPlan(
    projectRoot,
    options = {}
) {
    const plan =
        readPlan(
            projectRoot
        );

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

    const currentDeclarations =
        scanProject(
            projectRoot,
            { quiet: true }
        );

    const currentMap =
        new Map();

    for (
        const declaration
        of currentDeclarations
    ) {
        if (
            typeof declaration?.identity ===
                "string"
        ) {
            currentMap.set(
                declaration.identity,
                declaration
            );
        }
    }

    const impactGraph =
        buildImpactGraph(
            projectRoot,
            baselineDeclarations,
            currentDeclarations
        );

    const results = [];

    const nodes =
        Array.isArray(plan?.nodes)
            ? plan.nodes
            : [];

    for (
        const node
        of nodes
    ) {
        if (
            !isApproved(node)
        ) {
            continue;
        }

        if (
            !hasIdentity(node)
        ) {
            continue;
        }

        const declaration =
            currentMap.get(
                node.identity
            );

        if (
            !declaration
        ) {
            const impactResult =
                findImpact(
                    impactGraph,
                    node.identity,
                    {
                        maxDepth:
                            options.maxDepth ?? 3,

                        maxResults:
                            options.maxResults ?? 25
                    }
                );

            results.push(
                createResult(
                    node,
                    plan,
                    "error",
                    {
                        errors: [
                            {
                                message:
                                    "approved declaration is missing from current project"
                            }
                        ],
                        impact:
                            impactResult.affected ?? []
                    }
                )
            );

            continue;
        }

        const unsupported =
            evaluateStructureRules(
                node
            );

        const evaluation =
            evaluateBehaviourRules(
                node,
                declaration
            );

        let status = "implemented";

        if (
            evaluation.errors.length > 0
        ) {
            status = "error";
        } else if (
            evaluation.violations.length > 0
        ) {
            status = "drifted";
        }

        let impact = [];

        if (
            status !== "implemented"
        ) {
            const impactResult =
                findImpact(
                    impactGraph,
                    node.identity,
                    {
                        maxDepth:
                            options.maxDepth ?? 3,

                        maxResults:
                            options.maxResults ?? 25
                    }
                );

            impact =
                impactResult.affected ?? [];
        }

        results.push(
            createResult(
                node,
                plan,
                status,
                {
                    violations:
                        evaluation.violations,

                    errors:
                        evaluation.errors,

                    unsupported,

                    impact
                }
            )
        );
    }

    const summary = {
        total:
            results.length,

        implemented:
            results.filter(
                result =>
                    result.status ===
                    "implemented"
            ).length,

        drifted:
            results.filter(
                result =>
                    result.status ===
                    "drifted"
            ).length,

        error:
            results.filter(
                result =>
                    result.status ===
                    "error"
            ).length,

        unsupported:
            results.filter(
                result =>
                    Array.isArray(result.unsupported) &&
                    result.unsupported.length > 0
            ).length
    };

    return {
        results,
        summary
    };
}
