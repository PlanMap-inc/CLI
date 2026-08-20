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
// Feature vocabulary comes from:
//
//     node.feature
//
// with node.category retained as a backwards-compatible
// fallback.
//
// Tags are collected from node.tags.
//
// Vocabulary is deduplicated case-insensitively while
// preserving the first stored spelling.
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

        // Backwards-compatible alias.
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
// 4-Requeues temporary path-fallback events for LLM retry.
// 5-Returns new events plus retryable fallback events.
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


            if (
                !existingNode
            ) {
                return true;
            }


            /*
             * A path fallback is temporary.
             *
             * If the LLM was unavailable during a previous run,
             * the event remains in evolution.json with
             * labelSource/tagSource set to "path".
             *
             * Such an event MUST be sent to the LLM again on the
             * next run so classification can be retried.
             */

            return (
                existingNode.labelSource ===
                    "path" ||

                existingNode.tagSource ===
                    "path"
            );
        }
    );
}


// --------------------------------------------------
// GET FALLBACK TAGS
// --------------------------------------------------
// Produces deterministic tags when the LLM is unavailable.
// --------------------------------------------------

export function getFallbackTags(
    event,
    facts
) {

    const tags =
        [];


    const properties =
        facts?.properties ||
        {};


    const source =
        JSON.stringify(
            properties
        ).toLowerCase();


    if (
        source.includes(
            "req"
        ) ||
        source.includes(
            "request"
        )
    ) {

        tags.push(
            "api"
        );
    }


    if (
        source.includes(
            "res"
        ) ||
        source.includes(
            "response"
        )
    ) {

        if (
            !tags.includes(
                "api"
            )
        ) {

            tags.push(
                "api"
            );
        }
    }


    if (
        event.identity
            .toLowerCase()
            .includes(
                "controller"
            )
    ) {

        if (
            !tags.includes(
                "backend"
            )
        ) {

            tags.push(
                "backend"
            );
        }
    }


    return tags;
}


// --------------------------------------------------
// APPLY LLM EVOLUTION CLASSIFICATION
// --------------------------------------------------
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
//
// IMPORTANT:
// The feature/category MUST be persisted on the node.
// This allows getEvolutionVocabulary() to carry the
// feature vocabulary into the next LLM batch.
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
         * A path classification is temporary and may be
         * replaced by a successful LLM classification later.
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
            // FEATURE VOCABULARY
            // --------------------------------------------------
            // This is the critical persistence step.
            //
            // The next batch calls getEvolutionVocabulary()
            // against evolution.nodes. Therefore the feature
            // must actually live on the stored node.
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


                // Keep category for backwards compatibility.
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

            const fallbackFeature =
                fallback.feature ||
                fallback.category ||
                "Unclassified";


            // --------------------------------------------------
            // PERSIST FALLBACK FEATURE
            // --------------------------------------------------

            node.feature =
                fallbackFeature;


            node.category =
                node.feature;


            // --------------------------------------------------
            // FALLBACK LABEL
            // --------------------------------------------------

            node.label =
                fallback.label;


            // --------------------------------------------------
            // FALLBACK TAGS
            // --------------------------------------------------

            node.tags =
                Array.isArray(
                    fallback.tags
                )
                    ? [
                        ...fallback.tags
                    ]
                    : [];


            // --------------------------------------------------
            // FALLBACK SOURCE
            // --------------------------------------------------

            node.labelSource =
                "path";


            node.tagSource =
                "path";
        }
    }


    return evolution;
}