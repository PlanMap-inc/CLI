import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// LOAD OPENROUTER API KEY
// --------------------------------------------------
// 1-Checks process.env first.
// 2-Falls back to the project .env file.
// 3-Returns the API key when found.
// 4-Returns null when the key is unavailable.
// --------------------------------------------------

export function loadOpenRouterApiKey() {

    if (
        process.env.OPENROUTER_API_KEY
    ) {
        return process.env.OPENROUTER_API_KEY.trim();
    }


    const envPath =
        path.resolve(
            process.cwd(),
            ".env"
        );


    if (
        !fs.existsSync(
            envPath
        )
    ) {
        return null;
    }


    const envText =
        fs.readFileSync(
            envPath,
            "utf8"
        );


    const lines =
        envText.split(/\r?\n/);


    for (
        const line
        of lines
    ) {

        const trimmed =
            line.trim();


        if (
            trimmed.startsWith(
                "OPENROUTER_API_KEY="
            )
        ) {

            const value =
                trimmed
                    .slice(
                        "OPENROUTER_API_KEY=".length
                    )
                    .trim()
                    .replace(
                        /^["']|["']$/g,
                        ""
                    );


            if (
                value
            ) {
                return value;
            }
        }
    }


    return null;
}


// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

export const OPENROUTER_MODEL =
    "google/gemini-2.5-flash";


export const OPENROUTER_ENDPOINT =
    "https://openrouter.ai/api/v1/chat/completions";