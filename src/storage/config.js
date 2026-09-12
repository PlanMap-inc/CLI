import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// DEFAULT CONFIG
// --------------------------------------------------

const DEFAULT_CONFIG = {
    significance: {
        noiseCallPrefixes: [
            "console.",
            "logger.",
            "debug."
        ]
    }
};


// --------------------------------------------------
// LOAD PROJECT CONFIG
// --------------------------------------------------

export function loadConfig(
    projectRoot
) {
    const configPath =
        path.join(
            projectRoot,
            ".planmap",
            "config.json"
        );

    if (
        !fs.existsSync(
            configPath
        )
    ) {
        return structuredClone(
            DEFAULT_CONFIG
        );
    }

    try {
        const content =
            fs.readFileSync(
                configPath,
                "utf8"
            );

        const parsed =
            JSON.parse(
                content
            );

        return {
            ...structuredClone(
                DEFAULT_CONFIG
            ),
            ...parsed,
            significance: {
                ...structuredClone(
                    DEFAULT_CONFIG.significance
                ),
                ...(parsed.significance || {})
            }
        };
    }
    catch (error) {
        console.error(
            `Warning: invalid .planmap/config.json: ${error.message}`
        );

        return structuredClone(
            DEFAULT_CONFIG
        );
    }
}


// --------------------------------------------------
// WRITE DEFAULT CONFIG
// --------------------------------------------------

export function writeDefaultConfig(
    projectRoot
) {
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

    const configPath =
        path.join(
            planmapDirectory,
            "config.json"
        );

    if (
        fs.existsSync(
            configPath
        )
    ) {
        return configPath;
    }

    fs.writeFileSync(
        configPath,
        JSON.stringify(
            DEFAULT_CONFIG,
            null,
            2
        ) + "\n",
        "utf8"
    );

    return configPath;
}


export {
    DEFAULT_CONFIG
};
