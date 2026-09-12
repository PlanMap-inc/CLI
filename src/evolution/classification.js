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

        file: "",
        kind: "",

        properties: {}
    };
}



// --------------------------------------------------
// GET EXISTING EVOLUTION VOCABULARY
// --------------------------------------------------
// Existing features and tags are passed to the LLM.
//
// This keeps terminology stable across multiple
// evolution sessions and, importantly, across
// multiple LLM batches.
// --------------------------------------------------

export function getEvolutionVocabulary(
    evolution,
    plan = null
) {

    /*
     * --------------------------------------------------
     * PLAN VOCABULARY AUTHORITY
     * --------------------------------------------------
     *
     * When plan.json contains lenses, the Plan owns
     * the vocabulary used by Evolution classification.
     *
     * Evolution must reuse these values and must not
     * invent replacement tags.
     * --------------------------------------------------
     */

    if (
        Array.isArray(
            plan?.lenses
        ) &&
        plan.lenses.length > 0
    ) {

        const features =
            Array.isArray(
                plan.features
            )
                ? plan.features
                    .map(
                        feature =>
                            typeof feature === "string"
                                ? feature.trim()
                                : feature?.name?.trim()
                    )
                    .filter(
                        Boolean
                    )
                : [];

        const tags =
            plan.lenses
                .map(
                    lens =>
                        typeof lens === "string"
                            ? lens.trim()
                            : lens?.id?.trim()
                )
                .filter(
                    Boolean
                );

        return {

            features,

            categories:
                features,

            tags,

            authoritative:
                true
        };
    }


    /*
     * --------------------------------------------------
     * DERIVED VOCABULARY
     * --------------------------------------------------
     *
     * No authoritative Plan means preserve the existing
     * Layer 0 behaviour exactly as before.
     * --------------------------------------------------
     */

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

        // Only successful LLM classifications define the
        // vocabulary used by later LLM batches.
        //
        // Path fallback values such as "Unclassified" are
        // temporary and must never become vocabulary.
        if (
            node.labelSource !== "llm"
        ) {
            continue;
        }


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

        tags,

        authoritative:
            false
    };
}


// --------------------------------------------------
// GET NEW EVOLUTION EVENTS
// --------------------------------------------------
// An event is considered complete ONLY when both
// classification sources are "llm".
//
// This is important for batching recovery.
//
// If a node has:
// - labelSource === "llm"
// - tagSource === "llm"
//
// it is complete.
//
// If either source is:
// - "path"
// - undefined
// - null
// - any future non-LLM source
//
// it is retried.
//
// This makes partially persisted batches recoverable.
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

            /*
             * Evolution only consumes declaration events.
             *
             * Session lifecycle events such as
             * "session_started" do not have an identity
             * and must never enter the Evolution pipeline.
             */
            if (
                event?.type !== "added" &&
                event?.type !== "changed" &&
                event?.type !== "deleted"
            ) {
                return false;
            }

            if (
                typeof event?.identity !== "string" ||
                event.identity.length === 0
            ) {
                return false;
            }

            const key =
                `${event.ts}|${event.type}|${event.identity}`;


            const existingNode =
                storedNodes.get(
                    key
                );


            // ------------------------------------------
            // EVENT DOES NOT EXIST YET
            // ------------------------------------------

            if (
                !existingNode
            ) {

                return true;
            }


            // ------------------------------------------
            // ONLY A FULL LLM CLASSIFICATION IS DONE
            // ------------------------------------------
            //
            // Missing source values are deliberately
            // treated as incomplete.
            //
            // This fixes the stranded-event problem
            // after a batch failure.
            // ------------------------------------------

            return (
                existingNode.labelSource !== "llm" ||
                existingNode.tagSource !== "llm"
            );
        }
    );
}



// --------------------------------------------------
// GET FALLBACK TAGS
// --------------------------------------------------
// Produces deterministic tags when the LLM is
// unavailable.
//
// This function uses only information already known
// by PlanMap. It never invents semantic information.
//
// These fallback tags are temporary and may be
// replaced by successful LLM classification later.
// --------------------------------------------------

export function getFallbackTags(
    event,
    facts
) {

    const tags =
        [];


    const identity =
        String(
            event?.identity ||
            ""
        ).toLowerCase();


    const file =
        String(
            facts?.file ||
            ""
        ).toLowerCase();


    const properties =
        facts?.properties ||
        {};


    const propertyText =
        JSON.stringify(
            properties
        ).toLowerCase();


    const source =
        `${identity} ${file} ${propertyText}`;


    // --------------------------------------------------
    // BACKEND
    // --------------------------------------------------

    if (
        source.includes(
            "controller"
        ) ||
        source.includes(
            "middleware"
        ) ||
        source.includes(
            "route"
        ) ||
        source.includes(
            "service"
        ) ||
        source.includes(
            "server"
        ) ||
        source.includes(
            "backend"
        )
    ) {

        tags.push(
            "backend"
        );
    }


    // --------------------------------------------------
    // API
    // --------------------------------------------------

    if (
        source.includes(
            "request"
        ) ||
        source.includes(
            "response"
        ) ||
        source.includes(
            "req."
        ) ||
        source.includes(
            "res."
        ) ||
        source.includes(
            "http"
        ) ||
        source.includes(
            "api"
        )
    ) {

        tags.push(
            "api"
        );
    }


    // --------------------------------------------------
    // DATABASE
    // --------------------------------------------------

    if (
        source.includes(
            "database"
        ) ||
        source.includes(
            "db"
        ) ||
        source.includes(
            "query"
        ) ||
        source.includes(
            "sql"
        ) ||
        source.includes(
            "postgres"
        ) ||
        source.includes(
            "mysql"
        ) ||
        source.includes(
            "mongo"
        )
    ) {

        tags.push(
            "database"
        );
    }


    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    if (
        source.includes(
            "auth"
        ) ||
        source.includes(
            "jwt"
        ) ||
        source.includes(
            "token"
        ) ||
        source.includes(
            "login"
        ) ||
        source.includes(
            "password"
        )
    ) {

        tags.push(
            "auth"
        );
    }


    // --------------------------------------------------
    // FRONTEND
    // --------------------------------------------------

    if (
        source.includes(
            "frontend"
        ) ||
        source.includes(
            "component"
        ) ||
        source.includes(
            ".jsx"
        ) ||
        source.includes(
            ".tsx"
        ) ||
        source.includes(
            "dom"
        ) ||
        source.includes(
            "window."
        )
    ) {

        tags.push(
            "frontend"
        );
    }


    // --------------------------------------------------
    // REMOVE DUPLICATES
    // --------------------------------------------------

    return [
        ...new Set(
            tags
        )
    ];
}



// --------------------------------------------------
// APPLY LLM EVOLUTION CLASSIFICATION
// --------------------------------------------------
// The LLM provides:
// - category
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
//
// Temporary fallback classifications remain
// retryable.
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


        // --------------------------------------------------
        // SUCCESSFUL LLM CLASSIFICATION IS FROZEN
        // --------------------------------------------------

        if (
            node.labelSource === "llm" &&
            node.tagSource === "llm"
        ) {

            continue;
        }


        const classification =
            classificationMap.get(
                key
            );


        // --------------------------------------------------
        // LLM CLASSIFICATION AVAILABLE
        // --------------------------------------------------

        if (
            classification
        ) {

            const category =
                classification.category ||
                classification.feature;


            if (
                category
            ) {

                node.category =
                    category;


                // ------------------------------------------
                // IMPORTANT:
                // Persist feature as well as category.
                //
                // getEvolutionVocabulary() reads
                // node.feature || node.category.
                //
                // Without this field, vocabulary cannot
                // be threaded between batches correctly.
                // ------------------------------------------

                node.feature =
                    category;
            }


            if (
                classification.label
            ) {

                node.label =
                    classification.label;
            }


            if (
                Array.isArray(
                    classification.tags
                )
            ) {

                node.tags =
                    classification.tags;
            }


            node.labelSource =
                "llm";


            node.tagSource =
                "llm";


            continue;
        }


        // --------------------------------------------------
        // FALLBACK CLASSIFICATION
        // --------------------------------------------------
        //
        // If the LLM did not return a classification
        // for this node, use the deterministic fallback.
        //
        // These values remain marked as "path" so the
        // event can be retried by the LLM later.
        // --------------------------------------------------

        const fallback =
            fallbackMap.get(
                key
            );


        if (
            fallback
        ) {

            if (
                fallback.category
            ) {

                node.category =
                    fallback.category;


                node.feature =
                    fallback.category;
            }


            if (
                fallback.label
            ) {

                node.label =
                    fallback.label;
            }


            if (
                Array.isArray(
                    fallback.tags
                )
            ) {

                node.tags =
                    fallback.tags;
            }


            node.labelSource =
                "path";


            node.tagSource =
                "path";
        }
    }


    return evolution;
}