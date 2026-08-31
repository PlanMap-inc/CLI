import fs from "node:fs";
import path from "node:path";

import {
    readEvents,
    groupTimeGroups,
    buildLineage
} from "../evolution/events.js";

import {
    readEvolution,
    writeEvolution
} from "../evolution/storage.js";

import {
    updateEvolution
} from "../evolution.js";

import {
    getEvolutionFacts,
    getEvolutionVocabulary,
    getNewEvolutionEvents,
    getFallbackTags,
    applyEvolutionClassification
} from "../evolution/classification.js";

import {
    getPathCategory
} from "../evolution/identity.js";

import {
    getEvolutionLabel,
    writeEvolutionMarkdown
} from "../evolution/markdown.js";

import {
    applyEvolutionStatus
} from "../evolution/status.js";

import {
    loadSessions
} from "../sessions.js";


// --------------------------------------------------
// EVOLUTION BATCH CONFIGURATION
// --------------------------------------------------

const BATCH_SIZE =
    30;


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

            return {
                ts:
                    event.ts,

                identity:
                    event.identity,

                type:
                    event.type,

                delta:
                    event.delta ||
                    {},

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
// 1-Groups events by source directory.
// 2-Sorts directories.
// 3-Sorts events inside each directory.
// 4-Splits into batches of 30.
// --------------------------------------------------

function createBatches(
    events
) {

    const eventsByDirectory =
        new Map();

    for (
        const event
        of events
    ) {

        const directory =
            getEventDirectory(
                event
            );

        if (
            !eventsByDirectory.has(
                directory
            )
        ) {

            eventsByDirectory.set(
                directory,
                []
            );
        }

        eventsByDirectory
            .get(
                directory
            )
            .push(
                event
            );
    }

    const directories =
        Array.from(
            eventsByDirectory.keys()
        ).sort();

    const labelBatches =
        [];

    for (
        const directory
        of directories
    ) {

        const directoryEvents =
            eventsByDirectory.get(
                directory
            );

        directoryEvents.sort(
            (
                left,
                right
            ) => {

                const timestampCompare =
                    String(
                        left.ts
                    ).localeCompare(
                        String(
                            right.ts
                        )
                    );

                if (
                    timestampCompare !==
                    0
                ) {

                    return timestampCompare;
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

        for (
            let index = 0;
            index < directoryEvents.length;
            index += BATCH_SIZE
        ) {

            labelBatches.push({

                directory,

                events:
                    directoryEvents.slice(
                        index,
                        index + BATCH_SIZE
                    )
            });
        }
    }

    return labelBatches;
}


// --------------------------------------------------
// RUN EVOLUTION
// --------------------------------------------------

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
            "Usage: node src/cli.js evolution <project-folder> [--md]"
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

        let totalClassified =
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
            !process.env.OPENROUTER_API_KEY
        ) {

            console.warn(
                "OPENROUTER_API_KEY not configured."
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
                        updatedEvolution
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

                let batchClassifications;

                try {

                    const {
                        classifyEvolutionEvents
                    } = await import(
                        "../llm.js"
                    );

                    batchClassifications =
                        await classifyEvolutionEvents(
                            batchLlmEvents,
                            vocabulary.features,
                            vocabulary.tags,
                            Number(
                                process.env.PLANMAP_MAX_TAGS ||
                                8
                            )
                        );

                    console.log(
                        `Gemini classified ${batchClassifications.length} event(s) in batch ${batchIndex + 1}.`
                    );

                } catch (
                    error
                ) {

                    console.warn(
                        `\nLabel batch ${batchIndex + 1} failed.`
                    );

                    console.warn(
                        `Evolution classification stopped: ${error.message}`
                    );

                    console.warn(
                        "Previously successful batches have already been persisted."
                    );

                    console.warn(
                        "Run the evolution command again to retry the remaining events."
                    );

                    break;
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
                `\nTotal LLM classifications applied: ${totalClassified}`
            );
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
}