import {
    readPlan
} from "../plan/storage.js";


// --------------------------------------------------
// PLAN LIST COMMAND
// --------------------------------------------------

export function runPlanList(
    projectRoot
) {
    const plan =
        readPlan(
            projectRoot
        );

    console.log(
        `Plan: ${projectRoot}`
    );

    console.log(
        `Version: ${plan.version}`
    );

    console.log(
        `Lenses: ${plan.lenses.length}`
    );

    console.log(
        `Features: ${plan.features.length}`
    );

    console.log(
        `Nodes: ${plan.nodes.length}`
    );

    for (
        const node of plan.nodes
    ) {
        console.log(
            `${node.id}  ${node.identity || "(greenfield)"}  ${node.status}`
        );
    }
}


// --------------------------------------------------
// PLAN SHOW COMMAND
// --------------------------------------------------

export function runPlanShow(
    projectRoot,
    identity
) {
    const plan =
        readPlan(
            projectRoot
        );

    const node =
        plan.nodes.find(
            candidate =>
                candidate.identity ===
                identity
        );

    if (
        !node
    ) {
        console.error(
            `Plan node not found: ${identity}`
        );

        return;
    }

    console.log(
        JSON.stringify(
            node,
            null,
            2
        )
    );
}
