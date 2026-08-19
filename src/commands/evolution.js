import fs from "node:fs";
import path from "node:path";

import {
    readEvents,
    groupSessions,
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


// --------------------------------------------------
// RUN EVOLUTION
// --------------------------------------------------
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Reads events.jsonl.
// 6-Groups events into deterministic sessions.
// 7-Builds lineage relationships.
// 8-Reads evolution.json.
// 9-Finds new evolution events.
// 10-Collects static facts for events requiring classification.
// 11-Sends events to Gemini.
// 12-Validates and stores successful classifications.
// 13-Uses temporary fallback metadata when Gemini is unavailable.
// 14-Writes evolution.json.
// 15-Prints sessions.
// 16-Prints lineage.
// 17-When --md is provided, writes EVOLUTION.md.
// --------------------------------------------------

export async function runEvolution(
    projectPath,
    markdownRequested = false
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js evolution <project-folder> [--md]"
        );

        process.exit(1);
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

        process.exit(1);
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {
        console.error(
            `Project path is not a folder: ${projectPath}`
        );

        process.exit(1);
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
        groupSessions(
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

    const newEvents =
        getNewEvolutionEvents(
            events,
            evolution
        );


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
        const factsByEvent =
            new Map();

        const llmEvents =
            newEvents.map(
                event => {
                    const facts =
                        getEvolutionFacts(
                            projectRoot,
                            event
                        );

                    factsByEvent.set(
                        `${event.ts}|${event.identity}`,
                        facts
                    );

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


        // --------------------------------------------------
        // EXISTING CATEGORY + TAG VOCABULARY
        // --------------------------------------------------

        const vocabulary =
            getEvolutionVocabulary(
                evolution
            );

        let classifications =
            [];

        const fallbackData =
            [];


        // --------------------------------------------------
        // PREPARE OFFLINE FALLBACK
        // --------------------------------------------------

        for (
            const event
            of newEvents
        ) {
            const facts =
                factsByEvent.get(
                    `${event.ts}|${event.identity}`
                );

            const pathCategory =
                getPathCategory(
                    event.identity
                );

            fallbackData.push({
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
            });
        }


        // --------------------------------------------------
        // CALL GEMINI
        // --------------------------------------------------

        try {
            const {
                classifyEvolutionEvents
            } = await import(
                "../llm.js"
            );

            classifications =
                await classifyEvolutionEvents(
                    llmEvents,
                    vocabulary.features,
                    vocabulary.tags,
                    Number(
                        process.env.PLANMAP_MAX_TAGS ||
                        8
                    )
                );

            console.log(
                `\nGemini classified ${classifications.length} evolution events.`
            );

        } catch (
            error
        ) {
            console.warn(
                "\nGemini classification unavailable."
            );

            console.warn(
                `Using offline fallback: ${error.message}`
            );

            classifications =
                [];
        }


        // --------------------------------------------------
        // APPLY CLASSIFICATION
        // --------------------------------------------------

        updatedEvolution =
            applyEvolutionClassification(
                updatedEvolution,
                classifications,
                fallbackData
            );
    }


    // --------------------------------------------------
    // WRITE EVOLUTION
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
        `\nEvolution sessions: ${sessions.length}\n`
    );

    for (
        let index = 0;
        index < sessions.length;
        index++
    ) {
        const session =
            sessions[index];

        console.log(
            `Session ${index + 1}`
        );

        for (
            const event
            of session
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

        if (
            node.parent
        ) {
            console.log(
                `    parent: ${node.parent.identity}`
            );
        } else {
            console.log(
                "    parent: none"
            );
        }
    }


    // --------------------------------------------------
    // PRINT EVOLUTION STORE
    // --------------------------------------------------

    console.log(
        `\nEvolution written: ${evolutionPath}`
    );


    // --------------------------------------------------
    // WRITE MARKDOWN
    // --------------------------------------------------

    if (
        markdownRequested
    ) {
        const markdownPath =
            writeEvolutionMarkdown(
                projectRoot,
                updatedEvolution
            );

        console.log(
            `Evolution Markdown written: ${markdownPath}`
        );
    }
}