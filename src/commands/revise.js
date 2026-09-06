import {
    readPlan,
    writePlan
} from "../plan/storage.js";

import {
    reviseNode
} from "../plan/approval.js";


// --------------------------------------------------
// PLAN REVISE COMMAND
// --------------------------------------------------

export function runPlanRevise(
    projectRoot,
    identity = null
) {
    if (
        !projectRoot ||
        !identity
    ) {
        console.error(
            "Usage: planmap plan revise <project> <identity>"
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
            `Revise failed: ${error.message}`
        );

        process.exitCode = 1;

        return;
    }

    const index =
        plan.nodes.findIndex(
            node =>
                node.identity ===
                identity
        );

    if (
        index === -1
    ) {
        console.error(
            `Plan node not found: ${identity}`
        );

        process.exitCode = 1;

        return;
    }

    const node =
        plan.nodes[index];

    const result =
        reviseNode(
            node
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
        !result.changed
    ) {
        console.log(
            `Already intended: ${identity}`
        );

        process.exitCode = 2;

        return;
    }

    const nextNodes =
        plan.nodes.map(
            (
                currentNode,
                nodeIndex
            ) =>
                nodeIndex === index
                    ? result.node
                    : currentNode
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
            `Revise failed: ${error.message}`
        );

        process.exitCode = 1;

        return;
    }

    console.log(
        `Revised: ${identity}`
    );

    process.exitCode = 0;
}
