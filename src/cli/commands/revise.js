import {
    readPlan,
    writePlan
} from "../../plan/storage.js";

import {
    reviseNode
} from "../../plan/approval.js";


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

    let index = -1;

    for (
        let nodeIndex = 0;
        nodeIndex < plan.nodes.length;
        nodeIndex += 1
    ) {
        if (
            plan.nodes[nodeIndex]?.identity ===
            identity
        ) {
            index = nodeIndex;
        }
    }

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

    let maximumNodeNumber = 0;

    for (
        const currentNode of plan.nodes
    ) {
        const match =
            /^plan_(\d+)$/.exec(
                currentNode?.id || ""
            );

        if (
            match
        ) {
            maximumNodeNumber =
                Math.max(
                    maximumNodeNumber,
                    Number(match[1])
                );
        }
    }

    const nextNodeId =
        `plan_${String(
            maximumNodeNumber + 1
        ).padStart(
            4,
            "0"
        )}`;

    const previousVersion =
        Number.isInteger(node.version)
            ? node.version
            : 1;

    const nextNode = {
        ...result.node,
        id:
            nextNodeId,
        version:
            previousVersion + 1,
        supersedes:
            node.id,
        history: [
            ...(Array.isArray(node.history)
                ? node.history
                : []),
            {
                id:
                    node.id,
                version:
                    previousVersion,
                identity:
                    node.identity,
                title:
                    node.title,
                intent:
                    node.intent,
                status:
                    node.status,
                origin:
                    node.origin
            }
        ]
    };

    const nextPlan = {
        ...plan,
        nodes: plan.nodes.map(
            (currentNode, currentIndex) =>
                currentIndex === index
                    ? nextNode
                    : currentNode
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
