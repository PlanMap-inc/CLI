import fs from "node:fs";

import {
    addPlanNode,
    renamePlanFeature,
    renamePlanNode,
    movePlanNode,
    reorderPlanNode
} from "../../plan/authoring.js";

import {
    getPlanPath,
    readPlan,
    writePlan
} from "../../plan/storage.js";

import {
    validatePlan
} from "../../plan/model.js";

import {
    callOpenRouter,
    draftBrownfield,
    draftGreenfield,
    linkFeatureSteps
} from "../../plan/draft.js";

import {
    summariseFeatures,
    titleSummaries
} from "../../plan/summarise.js";

import {
    readBaseline
} from "../../changes/check.js";

import {
    buildCallGraph
} from "../../baseline/callgraph.js";


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

    const statusCounts = {
        intended: 0,
        approved: 0,
        implemented: 0,
        drifted: 0,
        error: 0
    };

    for (
        const node of plan.nodes
    ) {
        if (
            Object.prototype.hasOwnProperty.call(
                statusCounts,
                node.status
            )
        ) {
            statusCounts[node.status] += 1;
        }
    }

    console.log(
        `Status: intended=${statusCounts.intended} approved=${statusCounts.approved} implemented=${statusCounts.implemented} drifted=${statusCounts.drifted} error=${statusCounts.error}`
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
            "Usage: node src/cli/cli.js plan draft <project> [--from \"<description>\"]"
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

        reportSummaries(
            result.summarised,
            result.titleFallbacks
        );

        if (
            result.skipped?.length > 0
        ) {
            console.log(
                `Skipped, the model got these wrong: ${result.skipped.length}`
            );

            for (
                const line of result.skipped
            ) {
                console.log(
                    `  ${line}`
                );
            }
        }

        if (
            result.dropped?.length > 0
        ) {
            console.log(
                `Dropped rule checks verify can't evaluate: ${result.dropped.length}`
            );

            for (
                const line of result.dropped
            ) {
                console.log(
                    `  ${line}`
                );
            }
        }
    } catch (
        error
    ) {
        if (
            error.message ===
            "OPENROUTER_API_KEY is not configured."
        ) {
            console.error(
                "Cannot draft: OPENROUTER_API_KEY is not configured."
            );

            console.error(
                "Set it, or write .planmap/plan.json by hand."
            );

            process.exitCode = 2;
            return;
        }

        if (
            error.message.startsWith(
                "Cannot draft: no evolution history found."
            )
        ) {
            console.error(
                error.message
            );

            process.exitCode = 2;
            return;
        }

        if (
            error.message.startsWith(
                "Cannot draft: no features found in the evolution graph."
            )
        ) {
            console.error(
                error.message
            );

            process.exitCode = 2;
            return;
        }

        console.error(
            `Plan draft failed: ${error.message}`
        );

        process.exitCode = 1;
    }
}


// --------------------------------------------------
// WHAT THE CAP DID
// --------------------------------------------------
// One line per feature that was over twenty steps, and one line per
// summary step whose title had to fall back. Both `plan draft` and
// `plan summarise` print them, because both run the same pass.
// --------------------------------------------------

function reportSummaries(
    report,
    fallbacks
) {
    for (
        const entry of report || []
    ) {
        console.log(
            entry.line
        );
    }

    // Grouped by reason. A run that could not reach the model at all
    // failed for one reason, once, and printing that reason 36 times -
    // measured on expressjs/express - buries the lines that differ.
    const byReason =
        new Map();

    for (
        const fallback of fallbacks || []
    ) {
        if (
            !byReason.has(fallback.reason)
        ) {
            byReason.set(
                fallback.reason,
                []
            );
        }

        byReason
            .get(fallback.reason)
            .push(fallback.id);
    }

    for (
        const [reason, ids] of byReason
    ) {
        console.log(
            ids.length === 1
                ? `Summary step ${ids[0]} uses a fallback title: ${reason}`
                : `${ids.length} summary steps use fallback titles: ${reason}`
        );
    }
}


// --------------------------------------------------
// PLAN SUMMARISE COMMAND
// --------------------------------------------------
// The cap on its own, over a plan that already exists. The draft runs the
// same pass at the end of its last batch; this is for a plan drafted
// before the cap existed, or one whose features grew past it since.
//
// Running it twice changes nothing the second time: a feature that already
// fits is left alone, summary steps and all.
// --------------------------------------------------

export async function runPlanSummarise(
    projectRoot
) {
    if (
        !projectRoot
    ) {
        console.error(
            "Usage: planmap plan summarise <project>"
        );

        process.exitCode = 1;

        return;
    }

    let plan;

    let callGraph;

    try {
        plan =
            readPlan(
                projectRoot
            );

        callGraph =
            buildCallGraph(
                readBaseline(
                    projectRoot
                )?.declarations || []
            );
    } catch (
        error
    ) {
        console.error(
            `Plan summarise failed: ${error.message}`
        );

        process.exitCode = 1;

        return;
    }

    const {
        nodes,
        summaries,
        report
    } =
        summariseFeatures(
            plan,
            { callGraph }
        );

    // --------------------------------------------------
    // NOTHING FOLDED MEANS NOTHING WRITTEN
    // --------------------------------------------------
    // This used to relink and rewrite plan.json on every run, whatever it
    // found. Relinking replaces a feature's edges with the call graph's,
    // so the first run of this command on a plan somebody had ordered by
    // hand quietly threw that order away - while printing that every
    // feature was already inside the cap.
    //
    // A feature can also be over the cap with nothing to fold, because
    // its settled steps alone fill it. That is worth saying, and it is
    // not a reason to touch the file.
    // --------------------------------------------------
    if (
        summaries.length === 0
    ) {
        console.log(
            "Nothing to fold."
        );

        for (
            const entry of report
        ) {
            console.log(
                entry.line
            );
        }

        process.exitCode = 0;

        return;
    }

    // Every step keeps its fallback title when there is no model to ask.
    // That is the point of the fallback: the cap is deterministic, and
    // only the wording of a summary step ever needs one.
    const { fallbacks } =
        await titleSummaries(
            summaries,
            { call: callOpenRouter }
        );

    const nextPlan = {
        ...plan,

        nodes:
            linkFeatureSteps(
                nodes,
                callGraph
            )
    };

    const errors =
        validatePlan(
            nextPlan
        );

    if (
        errors.length > 0
    ) {
        console.error(
            "Plan summarise failed: the summarised plan is not valid."
        );

        for (
            const error of errors
        ) {
            console.error(
                `  - ${error}`
            );
        }

        process.exitCode = 1;

        return;
    }

    try {
        writePlan(
            projectRoot,
            nextPlan
        );
    } catch (
        error
    ) {
        console.error(
            `Plan summarise failed: ${error.message}`
        );

        process.exitCode = 1;

        return;
    }

    reportSummaries(
        report,
        fallbacks
    );

    process.exitCode = 0;
}


// --------------------------------------------------
// PLAN VALIDATE COMMAND
// --------------------------------------------------
// readPlan treats a plan that fails validation as an
// empty plan, so every command sees no nodes. This
// reports the same validation errors instead.
// 0 valid · 1 invalid · 2 no plan.json
// --------------------------------------------------

// --------------------------------------------------
// AUTHORING
// --------------------------------------------------
// Add, rename, move and reorder, each reporting what it changed. The canvas
// runs these; so can a terminal, with the same result.
// --------------------------------------------------

export function runPlanAuthoring(
    action,
    projectRoot,
    args
) {
    const flag =
        name => {
            const at = args.indexOf(name);
            return at === -1 ? null : args[at + 1] ?? null;
        };

    try {
        if (action === "add") {
            const node =
                addPlanNode(
                    projectRoot,
                    flag("--feature"),
                    flag("--title"),
                    {
                        intent: flag("--intent"),
                        after: flag("--after")
                    }
                );

            console.log(`Added: ${node.id} "${node.title}"`);
            return 0;
        }

        if (action === "rename") {
            const node =
                renamePlanNode(
                    projectRoot,
                    args[1],
                    flag("--title")
                );

            console.log(`Renamed: ${node.id} "${node.title}"`);
            return 0;
        }

        if (action === "rename-feature") {
            const feature =
                renamePlanFeature(
                    projectRoot,
                    args[1],
                    flag("--name")
                );

            console.log(`Renamed feature: ${feature.id} "${feature.name}"`);
            return 0;
        }

        if (action === "move") {
            const node =
                movePlanNode(
                    projectRoot,
                    args[1],
                    args.includes("--reset") ? null : flag("--x"),
                    args.includes("--reset") ? null : flag("--y")
                );

            console.log(
                node.x === undefined
                    ? `Moved: ${node.id} back to the layout`
                    : `Moved: ${node.id} to ${node.x},${node.y}`
            );
            return 0;
        }

        if (action === "order") {
            const node =
                reorderPlanNode(
                    projectRoot,
                    args[1],
                    {
                        after: flag("--after"),
                        toStart: args.includes("--first")
                    }
                );

            console.log(`Reordered: ${node.id}`);
            return 0;
        }

        console.error(`Unknown plan action: ${action}`);
        return 2;
    }
    catch (error) {
        console.error(error.message);
        return 2;
    }
}


export function runPlanValidate(
    projectRoot,
    options = {}
) {
    if (
        !projectRoot
    ) {
        console.error(
            "Usage: planmap plan validate <project> [--json]"
        );

        process.exitCode = 1;

        return;
    }

    const report =
        (valid, errors, message = null) => {
            if (options.json) {
                console.log(
                    JSON.stringify({
                        schema: 1,
                        valid,
                        errors,
                        ...(message ? { message } : {})
                    })
                );

                return;
            }

            if (message) {
                console.log(message);
            }

            if (valid) {
                console.log("plan.json is valid.");
            }

            for (
                const error of errors
            ) {
                console.log(
                    `  - ${error}`
                );
            }
        };

    const planPath =
        getPlanPath(
            projectRoot
        );

    if (
        !fs.existsSync(
            planPath
        )
    ) {
        report(
            false,
            [],
            "No plan found."
        );

        process.exitCode = 2;

        return;
    }

    let plan;

    try {
        plan =
            JSON.parse(
                fs.readFileSync(
                    planPath,
                    "utf8"
                )
            );
    } catch (
        error
    ) {
        report(
            false,
            [
                `plan.json is not valid JSON: ${error.message}`
            ]
        );

        process.exitCode = 1;

        return;
    }

    const errors =
        validatePlan(
            plan
        );

    report(
        errors.length === 0,
        errors
    );

    process.exitCode =
        errors.length === 0
            ? 0
            : 1;
}
