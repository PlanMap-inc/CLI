// --------------------------------------------------
// EVOLUTION CLASSIFICATION VALIDATION
// --------------------------------------------------
// Validates the classification returned by the LLM.
//
// The LLM may suggest:
// - feature
// - label
// - tags
//
// PlanMap accepts the result only when it satisfies
// the structural and vocabulary rules defined here.
// --------------------------------------------------


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
    // EXISTING VOCABULARY
    // --------------------------------------------------

    const featureVocabulary =
        new Set(
            existingFeatures
                .map(
                    feature =>
                        typeof feature ===
                        "string"
                            ? feature
                            : feature?.name
                )
                .filter(
                    Boolean
                )
        );


    const tagVocabulary =
        new Set(
            existingTags
                .map(
                    tag =>
                        typeof tag ===
                        "string"
                            ? tag
                            : tag?.name
                )
                .filter(
                    Boolean
                )
        );


    // --------------------------------------------------
    // PROJECT-WIDE TAG COUNT
    // --------------------------------------------------

    const responseTags =
        new Set();


    for (
        const classification
        of classifications
    ) {

        if (
            !Array.isArray(
                classification?.tags
            )
        ) {
            continue;
        }


        for (
            const tag
            of classification.tags
        ) {

            if (
                typeof tag ===
                "string"
            ) {
                responseTags.add(
                    tag.trim()
                );
            }
        }
    }


    const combinedTags =
        new Set([
            ...tagVocabulary,
            ...responseTags
        ]);


    if (
        combinedTags.size >
        maxTags
    ) {
        throw new Error(
            `LLM introduced too many unique tags: ${combinedTags.size}. Maximum allowed: ${maxTags}.`
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


        if (
            classification.tags.length >
            3
        ) {
            throw new Error(
                `Classification at index ${index} contains more than 3 tags.`
            );
        }


        const tags =
            classification.tags
                .map(
                    tag =>
                        typeof tag ===
                        "string"
                            ? tag.trim()
                            : ""
                )
                .filter(
                    Boolean
                );


        // --------------------------------------------------
        // DUPLICATE TAGS
        // --------------------------------------------------

        if (
            new Set(tags).size !==
            tags.length
        ) {
            throw new Error(
                `Classification at index ${index} contains duplicate tags.`
            );
        }


        // --------------------------------------------------
        // ADD NEW TAGS TO VOCABULARY
        // --------------------------------------------------

        for (
            const tag
            of tags
        ) {
            tagVocabulary.add(
                tag
            );
        }


        // --------------------------------------------------
        // FEATURE + TAG SEPARATION
        // --------------------------------------------------
        // A tag should not simply repeat the feature name.

        const normalizedFeature =
            feature.toLowerCase();


        for (
            const tag
            of tags
        ) {

            if (
                tag.toLowerCase() ===
                normalizedFeature
            ) {
                throw new Error(
                    `Classification at index ${index} uses the feature name as a tag: "${tag}".`
                );
            }
        }


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
            tags
        });
    }


    // --------------------------------------------------
    // FINAL TAG VOCABULARY CHECK
    // --------------------------------------------------

    if (
        tagVocabulary.size >
        maxTags
    ) {
        throw new Error(
            `Final tag vocabulary contains ${tagVocabulary.size} unique tags. Maximum allowed: ${maxTags}.`
        );
    }


    // --------------------------------------------------
    // RETURN VALIDATED CLASSIFICATIONS
    // --------------------------------------------------

    return validated;
}