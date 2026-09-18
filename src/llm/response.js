// --------------------------------------------------
// OPENROUTER RESPONSE HELPERS
// --------------------------------------------------
// 1-Extracts text from an OpenRouter response.
// 2-Handles the different response shapes that may
//   be returned by the API.
// 3-Parses the extracted text as JSON.
// 4-Throws clear errors when the response is invalid.
// --------------------------------------------------


export function extractOpenRouterText(
    data
) {

    // OpenAI-compatible servers answer under choices[]; Ollama's own
    // /api/chat answers with a single message.
    const content =
        data?.choices?.[0]?.message?.content ??
        data?.message?.content;


    if (
        typeof content ===
        "string"
    ) {
        return content;
    }


    if (
        Array.isArray(content)
    ) {

        const textParts =
            content
                .filter(
                    part =>
                        typeof part?.text ===
                        "string"
                )
                .map(
                    part =>
                        part.text
                );


        if (
            textParts.length > 0
        ) {
            return textParts.join("");
        }
    }


    throw new Error(
        "OpenRouter response did not contain usable text."
    );
}


// --------------------------------------------------
// PARSE OPENROUTER JSON
// --------------------------------------------------
// 1-Receives the text returned by the model.
// 2-Removes Markdown code fences when present.
// 3-Parses the cleaned text as JSON.
// 4-Throws an error when parsing fails.
// --------------------------------------------------

export function parseOpenRouterJson(
    text
) {

    if (
        typeof text !==
        "string"
    ) {
        throw new Error(
            "OpenRouter response text must be a string."
        );
    }


    let cleaned =
        text.trim();


    // --------------------------------------------------
    // REMOVE MARKDOWN CODE FENCES
    // --------------------------------------------------

    if (
        cleaned.startsWith(
            "```"
        )
    ) {

        cleaned =
            cleaned
                .replace(
                    /^```(?:json)?\s*/i,
                    ""
                )
                .replace(
                    /\s*```$/,
                    ""
                )
                .trim();
    }


    // --------------------------------------------------
    // PARSE JSON
    // --------------------------------------------------

    try {

        return JSON.parse(
            cleaned
        );

    } catch (
        error
    ) {

        // Smaller models often wrap the JSON in a sentence
        // ("Here is the JSON array: [...]"). Take the JSON itself.
        const start =
            cleaned.search(
                /[[{]/
            );

        const end =
            Math.max(
                cleaned.lastIndexOf("]"),
                cleaned.lastIndexOf("}")
            );

        if (
            start !== -1 &&
            end > start
        ) {
            try {

                return JSON.parse(
                    cleaned.slice(
                        start,
                        end + 1
                    )
                );

            } catch {
                // Fall through to the original error.
            }
        }

        throw new Error(
            `OpenRouter returned invalid JSON: ${error.message}`
        );
    }
}