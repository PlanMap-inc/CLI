// --------------------------------------------------
// EVOLUTION CLASSIFICATION VALIDATION
// --------------------------------------------------
// Validates the classification returned by the LLM.
//
// The LLM may suggest:
// - feature
// - group
// - label
// - tags
//
// PlanMap accepts the result only when it satisfies
// the structural and vocabulary rules defined here.
//
// Tags are mapped onto the fixed lens vocabulary
// rather than checked against a growing one: an
// unusable tag is dropped, never a whole batch. A
// batch thrown away costs every declaration in it its
// label, which is how scans came back half-classified.
// --------------------------------------------------

import {
    canonicalLens,
    canonicalLenses
} from "./lenses.js";


export function validateClassification(
    classifications,
    events,
    existingFeatures,
    existingTags,
    maxTags
) {

    // --------------------------------------------------
    // BASIC RESPONSE VALIDATION
    // --------------------------------------------------

    if (
        !Array.isArray(
            classifications
        )
    ) {
        throw new Error(
            "LLM classification result must be an array."
        );
    }


    if (
        classifications.length !==
        events.length
    ) {
        throw new Error(
            `LLM returned ${classifications.length} classifications for ${events.length} events.`
        );
    }


    // --------------------------------------------------
    // VALIDATE EACH CLASSIFICATION
    // --------------------------------------------------

    const validated =
        [];


    for (
        let index = 0;
        index < classifications.length;
        index++
    ) {

        const classification =
            classifications[index];

        const event =
            events[index];


        if (
            !classification ||
            typeof classification !==
            "object"
        ) {
            throw new Error(
                `Invalid classification at index ${index}.`
            );
        }


        // --------------------------------------------------
        // TIMESTAMP
        // --------------------------------------------------

        if (
            classification.ts !==
            event.ts
        ) {
            throw new Error(
                `Classification timestamp mismatch at index ${index}.`
            );
        }


        // --------------------------------------------------
        // IDENTITY
        // --------------------------------------------------

        if (
            classification.identity !==
            event.identity
        ) {
            throw new Error(
                `Classification identity mismatch at index ${index}.`
            );
        }


        // --------------------------------------------------
        // FEATURE
        // --------------------------------------------------

        if (
            typeof classification.feature !==
            "string" ||
            classification.feature.trim() ===
            ""
        ) {
            throw new Error(
                `Classification at index ${index} has an invalid feature.`
            );
        }


        const feature =
            classification.feature.trim();


        // --------------------------------------------------
        // LABEL
        // --------------------------------------------------

        if (
            typeof classification.label !==
            "string" ||
            classification.label.trim() ===
            ""
        ) {
            throw new Error(
                `Classification at index ${index} has an invalid label.`
            );
        }


        const label =
            classification.label.trim();


        // --------------------------------------------------
        // LABEL LENGTH
        // --------------------------------------------------

        const labelWords =
            label
                .split(/\s+/)
                .filter(
                    Boolean
                );


        if (
            labelWords.length >
            8
        ) {
            throw new Error(
                `Classification at index ${index} has a label longer than 8 words.`
            );
        }


        // --------------------------------------------------
        // TAGS
        // --------------------------------------------------

        if (
            !Array.isArray(
                classification.tags
            )
        ) {
            throw new Error(
                `Classification at index ${index} must contain a tags array.`
            );
        }


        const normalizedFeature =
            feature.toLowerCase();


        // Mapped onto the fixed vocabulary, capped at three, and with any
        // tag that merely repeats the feature name dropped. An empty result
        // is filled from the declaration's own facts when the
        // classification is applied, so every node carries a lens.
        const tags =
            canonicalLenses(
                classification.tags
            )
                .filter(
                    tag =>
                        tag !==
                        normalizedFeature
                )
                .slice(
                    0,
                    3
                );


        // --------------------------------------------------
        // GROUP
        // --------------------------------------------------
        // The level between the feature and its declarations. Optional:
        // a graph written before groups existed, or a model that omits
        // one, leaves the declaration directly under its feature.

        const rawGroup =
            typeof classification.group ===
            "string"
                ? classification.group.trim()
                : "";


        // A group names a job, never a layer: "Authentication", not
        // "Security". A lens name here would put the same axis on two
        // levels, so it is dropped and the declaration sits under its
        // feature rather than under a heading that repeats a filter.
        const group =
            rawGroup &&
            rawGroup.toLowerCase() !==
                normalizedFeature &&
            !canonicalLens(rawGroup)
                ? rawGroup
                : "";


        // --------------------------------------------------
        // ARCHITECTURAL ROLE PROTECTION
        // --------------------------------------------------
        // Prevent source-code architecture words from
        // becoming product features.

        const forbiddenFeatureNames =
            new Set([
                "controller",
                "service",
                "middleware",
                "backend",
                "frontend",
                "file",
                "folder",
                "module",
                "javascript",
                "express",
                "api",
                "database"
            ]);


        if (
            forbiddenFeatureNames.has(
                normalizedFeature
            )
        ) {
            throw new Error(
                `Classification at index ${index} uses an architectural term as the feature: "${feature}".`
            );
        }


        // --------------------------------------------------
        // STORE VALIDATED RESULT
        // --------------------------------------------------

        validated.push({
            ...classification,
            feature,
            label,
            tags,

            ...(group
                ? { group }
                : {})
        });
    }


    // --------------------------------------------------
    // RETURN VALIDATED CLASSIFICATIONS
    // --------------------------------------------------

    return validated;
}