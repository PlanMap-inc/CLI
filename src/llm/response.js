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

    const content =
        data?.choices?.[0]?.message?.content;


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

        throw new Error(
            `OpenRouter returned invalid JSON: ${error.message}`
        );
    }
}