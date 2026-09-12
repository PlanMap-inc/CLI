import {
    readPlan,
    writePlan
} from "../../plan/storage.js";

import {
    readBaseline
} from "../../changes/check.js";

import {
    approveNode,
    selectNodes
} from "../../plan/approval.js";

import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";


// --------------------------------------------------
// PLAN APPROVE COMMAND
// --------------------------------------------------

export function runPlanApprove(
    projectRoot,
    target = null,
    options = {}
) {
    if (
        !projectRoot
    ) {
        console.error(
            "Usage: planmap approve <project> [target] [--all|--lens <lens>|--feature <feature>]"
        );

        process.exitCode = 1;

        return;
    }

    let plan;

    try {
        plan =
            readPlan(
                projectRoot
            );
    } catch (
        error
    ) {
        console.error(
            `Approve failed: ${error.message}`
        );

        process.exitCode = 1;

        return;
    }

    const selection =
        selectNodes(
            plan,
            {
                identity:
                    target,
                all:
                    options.all === true,
                lens:
                    options.lens || null,
                feature:
                    options.feature || null
            }
        );

    if (
        selection.errors.length > 0
    ) {
        for (
            const error
            of selection.errors
        ) {
            console.error(
                error
            );
        }

        process.exitCode = 1;

        return;
    }

    if (
        selection.matched.length === 0
    ) {
        console.error(
            "Nothing to approve."
        );

        process.exitCode = 2;

        return;
    }

    let baseline =
        null;

    const needsBaseline =
        selection.matched.some(
            node =>
                node.status ===
                "intended" &&
                typeof node.identity ===
                "string" &&
                node.identity.length > 0
        );

    if (
        needsBaseline
    ) {
        try {
            baseline =
                readBaseline(
                    projectRoot
                );
        } catch (
            error
        ) {
            console.error(
                `Approve failed: ${error.message}`
            );

            process.exitCode = 1;

            return;
        }
    }

    const approvedBy =
        process.env.PLANMAP_USER?.trim() ||
        (() => {
            try {
                return execFileSync(
                    "git",
                    ["config", "user.name"],
                    {
                        cwd: projectRoot,
                        encoding: "utf8",
                        stdio: ["ignore", "pipe", "ignore"]
                    }
                ).trim() || null;
            } catch {
                return null;
            }
        })() ||
        userInfo().username ||
        "unknown";

    const approvedAt =
        new Date().toISOString();

    let changed = 0;
    let errors = 0;

    const nextNodes =
        plan.nodes.map(
            node => {
                if (
                    !selection.matched.includes(
                        node
                    )
                ) {
                    return node;
                }

                let facts;

                if (
                    node.status ===
                    "intended" &&
                    node.identity
                ) {
                    const declaration =
                        baseline?.declarations?.find(
                            candidate =>
                                candidate.identity ===
                                node.identity
                        );

                    if (
                        !declaration
                    ) {
                        console.error(
                            `Cannot approve "${node.identity}": identity is not present in the baseline.`
                        );

                        errors += 1;

                        return node;
                    }

                    facts = {
                        throws:
                            declaration.properties?.throws,
                        throwTypes:
                            declaration.properties?.throwTypes,
                        returns:
                            declaration.properties?.returns,
                        returnsNullish:
                            declaration.properties?.returnsNullish,
                        calls:
                            declaration.properties?.calls,
                        numbers:
                            declaration.properties?.numbers,
                        awaits:
                            declaration.properties?.awaits,
                        catches:
                            declaration.properties?.catches,
                        emptyCatches:
                            declaration.properties?.emptyCatches,
                        params:
                            declaration.properties?.params
                    };
                }

                const result =
                    approveNode(
                        node,
                        {
                            approvedBy,
                            approvedAt,
                            facts
                        }
                    );

                if (
                    result.error
                ) {
                    console.error(
                        result.error
                    );

                    errors += 1;

                    return node;
                }

                if (
                    result.changed
                ) {
                    changed += 1;
                }

                return result.node;
            }
        );

    const nextPlan = {
        ...plan,
        nodes:
            nextNodes
    };

    try {
        writePlan(
            projectRoot,
            nextPlan
        );
    } catch (
        error
    ) {
        console.error(
            `Approve failed: ${error.message}`
        );

        process.exitCode = 1;

        return;
    }

    for (
        const node
        of selection.matched
    ) {
        if (
            node.status ===
            "approved"
        ) {
            console.log(
                `Already approved: ${node.identity || node.id}`
            );
        }
    }

    if (
        changed > 0
    ) {
        console.log(
            `Approved: ${changed}`
        );
    }

    if (
        errors > 0
    ) {
        process.exitCode = 1;

        return;
    }

    if (
        changed === 0
    ) {
        process.exitCode = 2;

        return;
    }

    process.exitCode = 0;
}
