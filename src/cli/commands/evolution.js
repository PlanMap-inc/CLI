import fs from "node:fs";
import path from "node:path";


import {
    readEvents,
    groupTimeGroups,
    buildLineage
} from "../../evolution/events.js";

import {
    describeDelta
} from "../../watching/events.js";

import {
    readEvolution,
    writeEvolution
} from "../../evolution/storage.js";

import {
    isLocalLlm,
    llmAvailable,
    LLM_ENDPOINT,
    LLM_MODEL
} from "../../llm/config.js";

import {
    updateEvolution
} from "../../evolution/evolution.js";

import {
    getEvolutionFacts,
    getEvolutionVocabulary,
    getNewEvolutionEvents,
    getFallbackTags,
    applyEvolutionClassification
} from "../../evolution/classification.js";

import {
    getPathCategory
} from "../../evolution/identity.js";

import {
    getEvolutionLabel,
    writeEvolutionMarkdown
} from "../../evolution/markdown.js";

import {
    applyEvolutionStatus
} from "../../evolution/status.js";

import {
    loadSessions
} from "../../watching/sessions.js";


// --------------------------------------------------
// EVOLUTION BATCH CONFIGURATION
// --------------------------------------------------

// A local model has a smaller context window than a hosted one, so it gets
// fewer declarations per request. PLANMAP_LLM_BATCH_SIZE overrides both.
const BATCH_SIZE =
    Number.parseInt(
        process.env.PLANMAP_LLM_BATCH_SIZE ?? "",
        10
    ) > 0
        ? Number.parseInt(
            process.env.PLANMAP_LLM_BATCH_SIZE,
            10
        )
        : isLocalLlm()
            ? 10
            : 30;


// --------------------------------------------------
// CLASSIFY, SPLITTING A FAILED BATCH
// --------------------------------------------------
// A request can fail because the prompt or its reply did not fit the model's
// context. Halving the batch makes both smaller, so the declarations are
// classified instead of falling back to path labels wholesale. A single
// declaration that still fails is the only thing left behind.
// --------------------------------------------------

async function classifyWithSplitting(
    events,
    classify,
    report,
    attempt = 0
) {
    try {

        return {
            classifications:
                await classify(
                    events
                ),

            failed: 0,

            error: null
        };

    } catch (
        error
    ) {

        // Two cases where waiting is the answer and splitting is not:
        // a server that is restarting, and a rate limit. A hosted free tier
        // often allows fewer tokens per minute than one batch costs, and
        // says how long to wait.
        const rateLimited =
            /\(429\)|rate.?limit/i.test(
                error.message
            );

        const waitSeconds =
            rateLimited
                ? Number(
                    /try again in ([\d.]+)\s*s/i.exec(
                        error.message
                    )?.[1]
                ) || 20
                : 5;

        if (
            (
                rateLimited ||
                /Cannot reach the model/.test(error.message)
            ) &&
            attempt < 3
        ) {
            report(
                rateLimited
                    ? `rate limited; waiting ${waitSeconds}s before trying again.`
                    // The error names the endpoint it could not reach, and
                    // that is the whole diagnosis - a local URL here means
                    // PlanMap never found your configuration. Do not swallow it.
                    : `${error.message} Waiting 5s and trying again.`
            );

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        Math.ceil(
                            (waitSeconds + 1) * 1000
                        )
                    )
            );

            return classifyWithSplitting(
                events,
                classify,
                report,
                attempt + 1
            );
        }

        if (
            events.length <= 1
        ) {
            return {
                classifications: [],
                failed: events.length,
                error
            };
        }

        report(
            `${events.length} at once failed (${error.message}); retrying in two halves.`
        );

        const middle =
            Math.ceil(
                events.length / 2
            );

        const left =
            await classifyWithSplitting(
                events.slice(
                    0,
                    middle
                ),
                classify,
                report
            );

        const right =
            await classifyWithSplitting(
                events.slice(
                    middle
                ),
                classify,
                report
            );

        return {
            classifications: [
                ...left.classifications,
                ...right.classifications
            ],

            failed:
                left.failed +
                right.failed,

            error:
                left.error ||
                right.error
        };
    }
}


// --------------------------------------------------
// CREATE DETERMINISTIC EVENT KEY
// --------------------------------------------------

function getEventKey(
    event
) {

    return (
        `${event.ts}|${event.identity}`
    );
}


// --------------------------------------------------
// GET EVENT DIRECTORY
// --------------------------------------------------

function getSessionEvolutionEvents(
    events,
    sessions
) {
    const eventsByIdentity =
        new Map();

    for (
        const event
        of events
    ) {
        if (
            typeof event?.identity !== "string" ||
            event.identity.length === 0
        ) {
            continue;
        }

        if (
            event.type !== "added" &&
            event.type !== "changed" &&
            event.type !== "deleted"
        ) {
            continue;
        }

        if (
            !eventsByIdentity.has(
                event.identity
            )
        ) {
            eventsByIdentity.set(
                event.identity,
                []
            );
        }

        eventsByIdentity
            .get(event.identity)
            .push(event);
    }

    const result =
        [];

    for (
        const session
        of sessions
    ) {
        if (
            session?.sealed !== true
        ) {
            continue;
        }

        for (
            const entry
            of session.entries || []
        ) {
            const candidates =
                eventsByIdentity.get(
                    entry.identity
                ) || [];

            const matching =
                candidates.filter(
                    event =>
                        event.type ===
                            entry.type &&
                        event.ts >=
                            session.openedAt &&
                        event.ts <=
                            session.sealedAt
                );

            const latest =
                matching[
                    matching.length - 1
                ];

            if (
                latest
            ) {
                result.push({
                    ...latest,

                    delta:
                        entry.type === "changed"
                            ? Object.fromEntries(
                                Object.entries(
                                    entry.netDelta || {}
                                ).map(
                                    ([property, value]) => [
                                        property,
                                        [
                                            value.before,
                                            value.after
                                        ]
                                    ]
                                )
                            )
                            : (
                                latest.delta ||
                                {}
                            )
                });
            }
        }
    }

    return result;
}


function readEvolutionBaseline(
    projectRoot
) {
    const baselinePath =
        path.join(
            projectRoot,
            ".planmap",
            "baseline.json"
        );

    if (
        !fs.existsSync(
            baselinePath
        )
    ) {
        return {
            declarations: []
        };
    }

    try {
        const content =
            fs.readFileSync(
                baselinePath,
                "utf8"
            );

        const baseline =
            JSON.parse(
                content
            );

        if (
            !Array.isArray(
                baseline?.declarations
            )
        ) {
            return {
                declarations: []
            };
        }

        return baseline;

    } catch (
        error
    ) {
        console.error(
            `Warning: could not read baseline.json: ${error.message}`
        );

        return {
            declarations: []
        };
    }
}


function buildGenesisEvents(
    baseline
) {
    const declarations =
        baseline?.declarations || [];

    const ts =
        baseline?.createdAt ||
        baseline?.timestamp ||
        new Date(0).toISOString();

    return declarations
        .filter(
            declaration =>
                typeof declaration?.identity === "string" &&
                declaration.identity.length > 0
        )
        .map(
            declaration => ({
                ts,
                identity:
                    declaration.identity,
                type:
                    "added",
                delta:
                    {},
                origin:
                    "baseline"
            })
        );
}


function getEventDirectory(
    event
) {

    const filePath =
        event.identity
            .split("::")[0];

    return path.dirname(
        filePath
    );
}


// --------------------------------------------------
// BUILD LLM EVENTS
// --------------------------------------------------

function buildLlmEvents(
    projectRoot,
    events,
    factsByEvent
) {

    return events.map(
        event => {

            const key =
                getEventKey(
                    event
                );

            let facts =
                factsByEvent.get(
                    key
                );

            if (
                !facts
            ) {

                facts =
                    getEvolutionFacts(
                        projectRoot,
                        event
                    );
            }

            const delta =
                event.delta ||
                {};

            // What changed, in sentences rather than arithmetic. A model
            // handed {"returns":[8,9]} describes the declaration; handed
            // "8 returns became 9 returns" it describes the change.
            const changed =
                describeDelta(
                    delta
                );

            return {
                ts:
                    event.ts,

                identity:
                    event.identity,

                type:
                    event.type,

                delta,

                ...(changed.length
                    ? { changed }
                    : {}),

                facts
            };
        }
    );
}


// --------------------------------------------------
// BUILD FALLBACK DATA
// --------------------------------------------------

function buildFallbackData(
    events,
    factsByEvent
) {

    return events.map(
        event => {

            const facts =
                factsByEvent.get(
                    getEventKey(
                        event
                    )
                );

            const pathCategory =
                getPathCategory(
                    event.identity
                );

            return {
                ts:
                    event.ts,

                identity:
                    event.identity,

                category:
                    pathCategory.category,

                label:
                    getEvolutionLabel(
                        event
                    ),

                tags:
                    getFallbackTags(
                        event,
                        facts
                    )
            };
        }
    );
}


// --------------------------------------------------
// CREATE DETERMINISTIC BATCHES
//
// 1-Sorts by directory, then time, then identity.
// 2-Packs batches to BATCH_SIZE across directories, so a project
//   with many small folders does not become many tiny requests.
// --------------------------------------------------

function createBatches(
    events
) {

    const sorted =
        [...events].sort(
            (
                left,
                right
            ) => {

                const byDirectory =
                    getEventDirectory(
                        left
                    ).localeCompare(
                        getEventDirectory(
                            right
                        )
                    );

                if (
                    byDirectory !== 0
                ) {
                    return byDirectory;
                }

                const byTimestamp =
                    String(
                        left.ts
                    ).localeCompare(
                        String(
                            right.ts
                        )
                    );

                if (
                    byTimestamp !== 0
                ) {
                    return byTimestamp;
                }

                return String(
                    left.identity
                ).localeCompare(
                    String(
                        right.identity
                    )
                );
            }
        );

    const labelBatches =
        [];

    for (
        let index = 0;
        index < sorted.length;
        index += BATCH_SIZE
    ) {

        const batchEvents =
            sorted.slice(
                index,
                index + BATCH_SIZE
            );

        const directories =
            [
                ...new Set(
                    batchEvents.map(
                        getEventDirectory
                    )
                )
            ];

        labelBatches.push({

            directory:
                directories.length === 1
                    ? directories[0]
                    : `${directories[0]} +${directories.length - 1} more`,

            events:
                batchEvents
        });
    }

    return labelBatches;
}


// --------------------------------------------------
// RUN EVOLUTION
// --------------------------------------------------

// --------------------------------------------------
// READ INTENT PLAN
// --------------------------------------------------
// 1-Reads .planmap/plan.json when it exists.
// 2-Invalid plans degrade to no authoritative vocabulary.
// 3-Existing Evolution behaviour remains unchanged.
// --------------------------------------------------

function readEvolutionPlan(
    projectRoot
) {

    const planPath =
        path.join(
            projectRoot,
            ".planmap",
            "plan.json"
        );


    if (
        !fs.existsSync(
            planPath
        )
    ) {

        return null;
    }


    try {

        const plan =
            JSON.parse(
                fs.readFileSync(
                    planPath,
                    "utf8"
                )
            );


        if (
            !plan ||
            typeof plan !== "object"
        ) {

            return null;
        }


        return plan;

    } catch (
        error
    ) {

        console.warn(
            `Warning: unable to read ${planPath}; using derived Evolution vocabulary.`
        );

        return null;
    }
}


export async function runEvolution(
    projectPath,
    markdownRequested = false
) {

    // --------------------------------------------------
    // VALIDATE PROJECT PATH
    // --------------------------------------------------

    if (
        !projectPath
    ) {

        console.error(
            "Usage: node src/cli/cli.js evolution <project-folder> [--md]"
        );

        process.exit(
            1
        );
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

        process.exit(
            1
        );
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {

        console.error(
            `Project path is not a folder: ${projectPath}`
        );

        process.exit(
            1
        );
    }


    // --------------------------------------------------
    // LOAD ENVIRONMENT
    // --------------------------------------------------

    if (
        typeof process.loadEnvFile ===
        "function"
    ) {

        try {

            process.loadEnvFile();

        } catch (
            error
        ) {

            // .env is optional.
        }
    }


    // --------------------------------------------------
    // READ EVOLUTION DATA
    // --------------------------------------------------

    const events =
        readEvents(
            projectRoot
        );

    const sessions =
        loadSessions(
            projectRoot
        );

    const baseline =
        readEvolutionBaseline(
            projectRoot
        );

    const genesisEvents =
        buildGenesisEvents(
            baseline
        );

    const timeGroups =
        groupTimeGroups(
            events
        );

    const lineage =
        buildLineage(
            events
        );

    const evolution =
        readEvolution(
            projectRoot
        );


    const plan =
        readEvolutionPlan(
            projectRoot
        );


    // --------------------------------------------------
    // FIND NEW EVENTS
    // --------------------------------------------------

    const sessionEvents =
        getSessionEvolutionEvents(
            events,
            sessions
        );

    const evolutionEvents =
        [
            ...genesisEvents,
            ...sessionEvents
        ];

    const newEvents =
        getNewEvolutionEvents(
            evolutionEvents,
            evolution
        );

    /*
     * Evolution is rebuilt from sealed session entries.
     *
     * Existing nodes are retained for historical continuity,
     * but raw watcher events that were never represented by a
     * sealed session entry are never added.
     */


    // --------------------------------------------------
    // ADD NEW EVENTS TO EVOLUTION STORE
    // --------------------------------------------------

    let updatedEvolution =
        updateEvolution(
            evolution,
            newEvents
        );


    // --------------------------------------------------
    // CLASSIFY NEW EVENTS
    // --------------------------------------------------

    if (
        newEvents.length > 0
    ) {

        // --------------------------------------------------
        // PREPARE STATIC FACTS
        // --------------------------------------------------

        const factsByEvent =
            new Map();

        for (
            const event
            of newEvents
        ) {

            const facts =
                getEvolutionFacts(
                    projectRoot,
                    event
                );

            factsByEvent.set(
                getEventKey(
                    event
                ),
                facts
            );
        }


        // --------------------------------------------------
        // CREATE BATCHES
        // --------------------------------------------------

        const labelBatches =
            createBatches(
                newEvents
            );

        console.log(
            `\nEvolution classification: ${newEvents.length} events in ${labelBatches.length} batch(es).`
        );

        // Which model is about to be asked. PlanMap falls back to a local
        // Ollama when no endpoint is configured, and the only way to tell
        // that had been to read the source - a run against a repo with no
        // .env beside it looks identical to a configured one until it hangs.
        console.log(
            `Model: ${LLM_MODEL} at ${LLM_ENDPOINT}${isLocalLlm() ? " (local)" : ""}`
        );

        let totalClassified =
            0;

        let failedBatchCount =
            0;


        // --------------------------------------------------
        // OFFLINE MODE
        // --------------------------------------------------
        // If no OpenRouter API key is configured,
        // do not attempt an LLM request.
        //
        // Instead, apply deterministic fallback
        // classification to every new event.
        //
        // These nodes remain marked as "path" so a
        // future run with an API key can retry them.
        // --------------------------------------------------

        if (
            !llmAvailable()
        ) {

            console.warn(
                "OPENROUTER_API_KEY not configured."
            );

            console.warn(
                "Set PLANMAP_LLM_ENDPOINT to use a local model instead."
            );

            console.warn(
                "Using deterministic fallback classification."
            );

            const fallbackData =
                buildFallbackData(
                    newEvents,
                    factsByEvent
                );

            updatedEvolution =
                applyEvolutionClassification(
                    updatedEvolution,
                    [],
                    fallbackData
                );

            writeEvolution(
                projectRoot,
                updatedEvolution
            );

            console.log(
                `Fallback classification applied to ${newEvents.length} event(s).`
            );

        } else {

            // --------------------------------------------------
            // PROCESS BATCHES SEQUENTIALLY
            // --------------------------------------------------

            for (
                let batchIndex = 0;
                batchIndex < labelBatches.length;
                batchIndex++
            ) {

                const batch =
                    labelBatches[
                        batchIndex
                    ];

                console.log(
                    `\nClassifying label batch ${batchIndex + 1}/${labelBatches.length}`
                );

                console.log(
                    `Directory: ${batch.directory}`
                );

                console.log(
                    `Events: ${batch.events.length}`
                );


                // --------------------------------------------------
                // BUILD CURRENT VOCABULARY
                //
                // Recalculated for every batch so vocabulary
                // learned in earlier batches is available to
                // later batches.
                // --------------------------------------------------

                const vocabulary =
                    getEvolutionVocabulary(
                        updatedEvolution,
                        plan
                    );


                // --------------------------------------------------
                // BUILD BATCH LLM EVENTS
                // --------------------------------------------------

                const batchLlmEvents =
                    buildLlmEvents(
                        projectRoot,
                        batch.events,
                        factsByEvent
                    );


                // --------------------------------------------------
                // LOAD LLM
                // --------------------------------------------------

                const {
                    classifyEvolutionEvents
                } = await import(
                    "../../llm/llm.js"
                );

                const attempt =
                    await classifyWithSplitting(
                        batchLlmEvents,
                        events =>
                            classifyEvolutionEvents(
                                events,
                                vocabulary.features,
                                vocabulary.tags,
                                Number(
                                    process.env.PLANMAP_MAX_TAGS ||
                                    8
                                ),
                                vocabulary.authoritative,
                                vocabulary.groups
                            ),
                        message =>
                            console.warn(
                                `Batch ${batchIndex + 1}: ${message}`
                            )
                    );

                const batchClassifications =
                    attempt.classifications;

                console.log(
                    `Classified ${batchClassifications.length} of ${batch.events.length} in batch ${batchIndex + 1}.`
                );

                if (
                    attempt.failed > 0
                ) {

                    console.warn(
                        `\nLabel batch ${batchIndex + 1}: ${attempt.failed} declaration(s) could not be classified: ${attempt.error?.message ?? "unknown error"}`
                    );

                    console.warn(
                        "They keep path labels, and are retried automatically on a future run."
                    );

                    failedBatchCount++;

                } else if (
                    batchClassifications.length <
                    batch.events.length
                ) {

                    console.warn(
                        `The model left ${batch.events.length - batchClassifications.length} out of batch ${batchIndex + 1}; they keep path labels and are retried on the next run.`
                    );
                }


                // --------------------------------------------------
                // BUILD FALLBACK DATA FOR THIS BATCH
                // --------------------------------------------------

                const batchFallbackData =
                    buildFallbackData(
                        batch.events,
                        factsByEvent
                    );


                // --------------------------------------------------
                // APPLY CLASSIFICATION
                // --------------------------------------------------

                updatedEvolution =
                    applyEvolutionClassification(
                        updatedEvolution,
                        batchClassifications,
                        batchFallbackData
                    );

                totalClassified +=
                    batchClassifications.length;


                // --------------------------------------------------
                // PERSIST IMMEDIATELY
                // --------------------------------------------------

                writeEvolution(
                    projectRoot,
                    updatedEvolution
                );

                console.log(
                    `Label batch ${batchIndex + 1} persisted successfully.`
                );
            }

            console.log(
                `\nEvolution classification: ${labelBatches.length} batch(es) · ` +
                `${labelBatches.length - failedBatchCount} succeeded · ` +
                `${failedBatchCount} fell back to path labels`
            );

            console.log(
                `Total LLM classifications applied: ${totalClassified}`
            );

            if (
                failedBatchCount > 0
            ) {
                process.exitCode = 1;
            }
        }
    }


    // --------------------------------------------------
    // DERIVE EVOLUTION STATUS
    // --------------------------------------------------

    updatedEvolution =
        applyEvolutionStatus(
            updatedEvolution
        );


    // --------------------------------------------------
    // WRITE FINAL EVOLUTION
    // --------------------------------------------------

    const evolutionPath =
        writeEvolution(
            projectRoot,
            updatedEvolution
        );


    // --------------------------------------------------
    // PRINT SESSIONS
    // --------------------------------------------------

    console.log(
        `\nTime groups: ${timeGroups.length}\n`
    );

    for (
        let index = 0;
        index < timeGroups.length;
        index++
    ) {

        const timeGroup =
            timeGroups[
                index
            ];

        console.log(
            `Time group ${index + 1}`
        );

        for (
            const event
            of timeGroup
        ) {

            console.log(
                `  ${event.ts}  ${event.type}  ${event.identity}`
            );
        }

        console.log();
    }


    // --------------------------------------------------
    // PRINT LINEAGE
    // --------------------------------------------------

    console.log(
        "\nLineage:\n"
    );

    for (
        const node
        of lineage
    ) {

        console.log(
            `  ${node.event.type}  ${node.event.identity}`
        );

        console.log(
            `    parent: ${
                node.parent
                    ? node.parent.identity
                    : "none"
            }`
        );
    }


    // --------------------------------------------------
    // WRITE MARKDOWN
    // --------------------------------------------------

    if (
        markdownRequested
    ) {

        const markdownPath =
            writeEvolutionMarkdown(
                projectRoot,
                updatedEvolution,
                timeGroups,
                lineage
            );

        console.log(
            `\nEvolution written: ${evolutionPath}`
        );

        console.log(
            `Evolution Markdown written: ${markdownPath}`
        );

    } else {

        console.log(
            `\nEvolution written: ${evolutionPath}`
        );
    }

    const labelled =
        (updatedEvolution.nodes || []).filter(
            node =>
                node.labelSource === "llm"
        ).length;

    console.log(
        `Labelled by the model: ${labelled} of ${(updatedEvolution.nodes || []).length}`
    );
}