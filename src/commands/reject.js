import {
    readPlan,
    writePlan
} from "../plan/storage.js";

import {
    rejectNode
} from "../plan/approval.js";


// --------------------------------------------------
// PLAN REJECT COMMAND
// --------------------------------------------------

export function runPlanReject(
    projectRoot,
    target = null,
    options = {}
) {
    if (
        !projectRoot ||
        !target
    ) {
        console.error(
            "Usage: planmap reject <project> <target> [--force]"
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
            `Reject failed: ${error.message}`
        );

        process.exitCode = 1;

        return;
    }

    const index =
        plan.nodes.findIndex(
            node =>
                node.identity ===
                target ||
                node.id ===
                target
        );

    if (
        index === -1
    ) {
        console.error(
            `Plan node not found: ${target}`
        );

        process.exitCode = 1;

        return;
    }

    const node =
        plan.nodes[index];

    const result =
        rejectNode(
            node,
            {
                force:
                    options.force === true
            }
        );

    if (
        result.error
    ) {
        console.error(
            result.error
        );

        process.exitCode = 1;

        return;
    }

    if (
        result.remove
    ) {
        const nextPlan = {
            ...plan,
            nodes:
                plan.nodes.filter(
                    (
                        _node,
                        nodeIndex
                    ) =>
                        nodeIndex !==
                        index
                )
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
                `Reject failed: ${error.message}`
            );

            process.exitCode = 1;

            return;
        }

        console.log(
            `Rejected: ${target}`
        );

        process.exitCode = 0;

        return;
    }

    process.exitCode = 1;
}
