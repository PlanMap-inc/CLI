import fs from "node:fs";
import path from "node:path";

// --------------------------------------------------
// GET EVOLUTION FACTS
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
        file: "",
        kind: "",
        properties: {}
    };
}
// --------------------------------------------------
// GET EXISTING EVOLUTION VOCABULARY
//
// Existing features and tags are passed to the LLM.
//
// This is what keeps terminology stable across
// multiple evolution sessions.
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

            if (!existingNode) {
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
                existingNode.labelSource === "path" ||
                existingNode.tagSource === "path"
            );
        }
    );
}
// --------------------------------------------------
// APPLY LLM EVOLUTION CLASSIFICATION
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


    for (
        const item
        of classifications
    ) {

        classificationMap.set(
            `${item.ts}|${item.identity}`,
            item
        );
    }


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


    for (
        const node
        of evolution.nodes || []
    ) {

        const key =
            `${node.ts}|${node.identity}`;


        /*
         * IMPORTANT:
         *
         * Only successful LLM classifications are frozen.
         *
         * A "path" classification is an offline fallback and
         * is intentionally temporary. It may be replaced by a
         * successful LLM classification on a later run.
         */

        if (
            node.labelSource === "llm" ||
            node.tagSource === "llm"
        ) {
            continue;
        }


        const classification =
            classificationMap.get(
                key
            );


        if (
            classification
        ) {

            node.feature =
                classification.feature;


            node.category =
                classification.feature;




            node.label =
                classification.label;


            node.tags =
                [
                    ...classification.tags
                ];


            node.labelSource =
                "llm";


            node.tagSource =
                "llm";


            continue;
        }


        /*
         * Offline fallback.
         */

        const fallback =
            fallbackMap.get(
                key
            );


        if (
            fallback
        ) {

            node.feature =
                fallback.feature ||
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

// --------------------------------------------------
// GET FALLBACK TAGS
// --------------------------------------------------
// Offline fallback must not invent architecture tags.
// Parent tags may be reused when available.
// Otherwise no tags are invented.
// --------------------------------------------------

export function getFallbackTags(
    event,
    facts,
    parentNode = null
) {
    if (
        parentNode &&
        Array.isArray(
            parentNode.tags
        )
    ) {
        return [
            ...parentNode.tags
        ];
    }

    return [];
}
