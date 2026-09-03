import fs from "node:fs";
import path from "node:path";

import {
    createEmptyPlan,
    validatePlan
} from "./model.js";


// --------------------------------------------------
// GET PLAN PATH
// --------------------------------------------------

export function getPlanPath(
    projectRoot
) {
    return path.join(
        projectRoot,
        ".planmap",
        "plan.json"
    );
}


// --------------------------------------------------
// READ PLAN
// 1-Returns an empty plan when plan.json does not exist.
// 2-Guards JSON parsing so malformed files never crash.
// 3-Validates the parsed structure.
// 4-Malformed or invalid plans degrade to an empty plan.
// --------------------------------------------------

export function readPlan(
    projectRoot
) {
    const planPath =
        getPlanPath(
            projectRoot
        );

    if (
        !fs.existsSync(
            planPath
        )
    ) {
        return createEmptyPlan();
    }

    let content;

    try {
        content =
            fs.readFileSync(
                planPath,
                "utf8"
            );
    } catch (error) {
        console.warn(
            `Warning: could not read plan.json: ${error.message}`
        );

        return createEmptyPlan();
    }

    let plan;

    try {
        plan =
            JSON.parse(
                content
            );
    } catch (error) {
        console.warn(
            `Warning: malformed plan.json: ${error.message}`
        );

        return createEmptyPlan();
    }

    const errors =
        validatePlan(
            plan
        );

    if (
        errors.length > 0
    ) {
        console.warn(
            "Warning: invalid plan.json:"
        );

        for (
            const error of errors
        ) {
            console.warn(
                `  - ${error}`
            );
        }

        return createEmptyPlan();
    }

    return plan;
}


// --------------------------------------------------
// WRITE PLAN
// 1-Creates .planmap when necessary.
// 2-Validates before writing.
// 3-Never writes an invalid plan.
// --------------------------------------------------

export function writePlan(
    projectRoot,
    plan
) {
    const errors =
        validatePlan(
            plan
        );

    if (
        errors.length > 0
    ) {
        throw new Error(
            `Cannot write invalid plan.json:\n${errors
                .map(
                    error =>
                        `- ${error}`
                )
                .join("\n")}`
        );
    }

    const planmapDirectory =
        path.join(
            projectRoot,
            ".planmap"
        );

    fs.mkdirSync(
        planmapDirectory,
        {
            recursive: true
        }
    );

    const planPath =
        getPlanPath(
            projectRoot
        );

    fs.writeFileSync(
        planPath,
        JSON.stringify(
            plan,
            null,
            2
        ) + "\n",
        "utf8"
    );

    return planPath;
}
