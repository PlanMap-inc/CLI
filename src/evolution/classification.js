import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// GET EVOLUTION FACTS
// --------------------------------------------------
// 1-Receives an event.
// 2-Reads the latest static properties for the declaration.
// 3-Uses the event delta when available.
// 4-Returns only facts already known by PlanMap.
// --------------------------------------------------

export function getEvolutionFacts(
    projectRoot,
    event
) {

    const baselinePath =
        path.join(
            projectRoot,
            ".planmap",
            "baseline.json"
        );


    let baseline =
        {
            declarations: []
        };


    if (
        fs.existsSync(
            baselinePath
        )
    ) {

        baseline =
            JSON.parse(
                fs.readFileSync(
                    baselinePath,
                    "utf8"
                )
            );
    }


    const baselineDeclaration =
        baseline.declarations.find(
            declaration =>
                declaration.identity ===
                event.identity
        );


    const after =
        event.delta &&
        event.delta.after;


    if (
        after
    ) {

        return {

            file:
                after.file ||
                baselineDeclaration?.file,

            kind:
                after.kind ||
                baselineDeclaration?.kind,

            properties:
                after.properties ||
                baselineDeclaration?.properties ||
                {}
        };
    }


    if (
        baselineDeclaration
    ) {

        return {

            file:
                baselineDeclaration.file,

            kind:
                baselineDeclaration.kind,

            properties:
                baselineDeclaration.properties ||
                {}
        };
    }


    return {

        file:
            "",

        kind:
            "",

        properties:
            {}
    };
}


// --------------------------------------------------
// GET EXISTING EVOLUTION VOCABULARY
// --------------------------------------------------
// Existing features and tags are passed to the LLM.
//
// This keeps terminology stable across multiple
// evolution batches and sessions.
// --------------------------------------------------

export function getEvolutionVocabulary(
    evolution
) {

    const features =
        [];


    const tags =
        [];


    const featureSet =
        new Set();


    const tagSet =
        new Set();


    for (
        const node
        of evolution.nodes || []
    ) {

        // --------------------------------------------------
        // FEATURE
        // --------------------------------------------------

        const feature =
            node.feature ||
            node.category;


        if (
            feature
        ) {

            const normalizedFeature =
                String(
                    feature
                ).trim();


            const featureKey =
                normalizedFeature
                    .toLowerCase();


            if (
                normalizedFeature &&
                !featureSet.has(
                    featureKey
                )
            ) {

                featureSet.add(
                    featureKey
                );


                features.push(
                    normalizedFeature
                );
            }
        }


        // --------------------------------------------------
        // TAGS
        // --------------------------------------------------

        for (
            const tag
            of node.tags || []
        ) {

            const normalizedTag =
                String(
                    tag
                ).trim();


            const tagKey =
                normalizedTag
                    .toLowerCase();


            if (
                normalizedTag &&
                !tagSet.has(
                    tagKey
                )
            ) {

                tagSet.add(
                    tagKey
                );


                tags.push(
                    normalizedTag
                );
            }
        }
    }


    return {

        features,

        categories:
            features,

        tags
    };
}


// --------------------------------------------------
// GET NEW EVOLUTION EVENTS
// --------------------------------------------------
// 1-Receives all events.
// 2-Receives the stored evolution.
// 3-Checks whether an event already exists.
// 4-Retries path fallbacks.
// 5-Retries events that were stored but never
//   successfully classified.
// 6-Returns events that still need LLM classification.
// --------------------------------------------------

export function getNewEvolutionEvents(
    events,
    evolution
) {

    const storedNodes =
        new Map(
            (evolution.nodes || [])
                .map(
                    node => [
                        `${node.ts}|${node.type}|${node.identity}`,
                        node
                    ]
                )
        );


    return events.filter(
        event => {

            const key =
                `${event.ts}|${event.type}|${event.identity}`;


            const existingNode =
                storedNodes.get(
                    key
                );


            // --------------------------------------------------
            // EVENT DOES NOT EXIST YET
            // --------------------------------------------------

            if (
                !existingNode
            ) {

                return true;
            }


            /*
             * IMPORTANT:
             *
             * A node is considered complete ONLY when the
             * LLM successfully classified it.
             *
             * Therefore:
             *
             * labelSource = "llm" -> completed
             *
             * labelSource = "path" -> retry
             *
             * labelSource = undefined -> retry
             *
             * missing source -> retry
             *
             * unknown future source -> retry
             *
             * This makes interrupted batches recoverable.
             */

            return (
                existingNode.labelSource !==
                    "llm" ||

                existingNode.tagSource !==
                    "llm"
            );
        }
    );
}


// --------------------------------------------------
// APPLY LLM EVOLUTION CLASSIFICATION
// --------------------------------------------------
//
// The LLM provides:
// - feature
// - label
// - tags
//
// PlanMap provides:
// - event identity
// - timestamp
// - lineage
//
// Successful LLM classifications are frozen.
// Temporary path fallbacks remain retryable.
// --------------------------------------------------

export function applyEvolutionClassification(
    evolution,
    classifications,
    fallbackData
) {

    const classificationMap =
        new Map();


    // --------------------------------------------------
    // INDEX LLM CLASSIFICATIONS
    // --------------------------------------------------

    for (
        const item
        of classifications
    ) {

        classificationMap.set(
            `${item.ts}|${item.identity}`,
            item
        );
    }


    // --------------------------------------------------
    // INDEX FALLBACK DATA
    // --------------------------------------------------

    const fallbackMap =
        new Map();


    for (
        const item
        of fallbackData
    ) {

        fallbackMap.set(
            `${item.ts}|${item.identity}`,
            item
        );
    }


    // --------------------------------------------------
    // APPLY CLASSIFICATIONS
    // --------------------------------------------------

    for (
        const node
        of evolution.nodes || []
    ) {

        const key =
            `${node.ts}|${node.identity}`;


        /*
         * Successful LLM classifications are frozen.
         *
         * Path classifications remain retryable.
         */

        if (
            node.labelSource ===
                "llm" ||

            node.tagSource ===
                "llm"
        ) {

            continue;
        }


        // --------------------------------------------------
        // FIND LLM CLASSIFICATION
        // --------------------------------------------------

        const classification =
            classificationMap.get(
                key
            );


        if (
            classification
        ) {

            // --------------------------------------------------
            // FEATURE
            // --------------------------------------------------
            // Accept either "feature" or "category".
            //
            // The stored feature is then available to the
            // next batch through getEvolutionVocabulary().
            // --------------------------------------------------

            const feature =
                classification.feature ||
                classification.category;


            if (
                feature
            ) {

                node.feature =
                    String(
                        feature
                    ).trim();


                node.category =
                    node.feature;
            }


            // --------------------------------------------------
            // LABEL
            // --------------------------------------------------

            node.label =
                classification.label;


            // --------------------------------------------------
            // TAGS
            // --------------------------------------------------

            node.tags =
                Array.isArray(
                    classification.tags
                )
                    ? [
                        ...classification.tags
                    ]
                    : [];


            // --------------------------------------------------
            // SOURCE
            // --------------------------------------------------

            node.labelSource =
                "llm";


            node.tagSource =
                "llm";


            continue;
        }


        // --------------------------------------------------
        // OFFLINE FALLBACK
        // --------------------------------------------------

        const fallback =
            fallbackMap.get(
                key
            );


        if (
            fallback
        ) {

            node.feature =
                fallback.feature ||
                fallback.category ||
                "Unclassified";


            node.category =
                node.feature;


            node.label =
                fallback.label;


            node.tags =
                Array.isArray(
                    fallback.tags
                )
                    ? [
                        ...fallback.tags
                    ]
                    : [];


            node.labelSource =
                "path";


            node.tagSource =
                "path";
        }
    }


    return evolution;
}