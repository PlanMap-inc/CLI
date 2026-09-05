import {
    readPlan,
    writePlan
} from "../plan/storage.js";

import {
    draftBrownfield,
    draftGreenfield
} from "../plan/draft.js";


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

        process.exitCode = 1;

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


// --------------------------------------------------
// PLAN DRAFT COMMAND
// --------------------------------------------------

export async function runPlanDraft(
    projectRoot,
    description = null
) {
    if (
        !projectRoot
    ) {
        console.error(
            "Usage: node src/cli.js plan draft <project> [--from \"<description>\"]"
        );

        process.exitCode = 1;

        return;
    }

    const resolvedRoot =
        projectRoot;

    try {
        if (
            description
        ) {
            const plan =
                await draftGreenfield(
                    resolvedRoot,
                    description
                );

            console.log(
                `Plan drafted: ${resolvedRoot}`
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

            return;
        }

        const result =
            await draftBrownfield(
                resolvedRoot
            );

        console.log(
            `Plan drafted: ${resolvedRoot}`
        );

        console.log(
            `Drafted nodes: ${result.drafted}`
        );

        console.log(
            `Batches: ${result.batches}`
        );
    } catch (
        error
    ) {
        console.error(
            `Plan draft failed: ${error.message}`
        );

        process.exitCode = 1;
    }
}
