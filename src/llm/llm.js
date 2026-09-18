import {
    isLocalLlm,
    loadLlmApiKey,
    ollamaChatEndpoint,
    LLM_MODEL,
    LLM_ENDPOINT,
    LLM_NUM_CTX
} from "./config.js";

import {
    buildEvolutionPrompt
} from "./prompts.js";

import {
    extractOpenRouterText,
    parseOpenRouterJson
} from "./response.js";

import {
    validateClassification
} from "./validation.js";


// --------------------------------------------------
// CLASSIFY EVOLUTION EVENTS
// --------------------------------------------------
// 1-Receives evolution events and existing vocabulary.
// 2-Loads the OpenRouter API key.
// 3-Builds the evolution classification prompt.
// 4-Sends the request to OpenRouter.
// 5-Extracts the model response.
// 6-Parses the JSON response.
// 7-Validates the classifications.
// 8-Returns validated classifications.
// --------------------------------------------------

export async function classifyEvolutionEvents(
    events,
    existingFeatures,
    existingTags,
    maxTags,
    authoritative = false,
    existingGroups = {}
) {

    // --------------------------------------------------
    // LOAD API KEY
    // --------------------------------------------------

    const apiKey =
        loadLlmApiKey();


    // A local server needs no key; a hosted one does.
    if (
        !apiKey &&
        !isLocalLlm()
    ) {
        throw new Error(
            "OPENROUTER_API_KEY is not configured."
        );
    }


    // --------------------------------------------------
    // BUILD PROMPT
    // --------------------------------------------------

    const prompt =
        buildEvolutionPrompt(
            events,
            existingFeatures,
            existingTags,
            maxTags,
            authoritative,
            existingGroups
        );


    // --------------------------------------------------
    // SEND REQUEST TO OPENROUTER
    // --------------------------------------------------

    // Ollama's own API accepts the context size per request; the
    // OpenAI-compatible one does not.
    const ollamaEndpoint =
        ollamaChatEndpoint();

    const requestBody =
        ollamaEndpoint
            ? {
                model:
                    LLM_MODEL,

                messages: [
                    {
                        role:
                            "user",

                        content:
                            prompt
                    }
                ],

                stream:
                    false,

                options: {
                    temperature:
                        0.1,

                    num_ctx:
                        LLM_NUM_CTX,

                    num_predict:
                        16000
                }
            }
            : null;

    let response;

    try {
        response =
            await fetch(
                ollamaEndpoint || LLM_ENDPOINT,
                {
                    method:
                        "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${apiKey || "local"}`,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        requestBody
                            ? JSON.stringify(requestBody)
                            : JSON.stringify({
                            model:
                                LLM_MODEL,

                            messages: [
                                {
                                    role:
                                        "user",

                                    content:
                                        prompt
                                }
                            ],

                            temperature:
                                0.1,

                            // --------------------------------------------------
                            // BATCHED REQUEST CEILING
                            // --------------------------------------------------
                            // Evolution events are processed in batches of
                            // 30 (see BATCH_SIZE in cli/commands/evolution.js).
                            // 2500 tokens was not enough for a full batch of
                            // long identifiers and caused truncated, invalid
                            // JSON responses. 8000 matched the ceiling used
                            // before batching was introduced. Reasoning models
                            // also count hidden reasoning against this limit,
                            // so it is 16000 to leave room for a full batch.
                            // --------------------------------------------------

                            max_tokens:
                                16000
                        })
                }
        );
    } catch (error) {
        throw new Error(
            `Cannot reach the model at ${LLM_ENDPOINT}: ${error.message}. Start it (ollama serve), or set PLANMAP_LLM_ENDPOINT.`
        );
    }


    // --------------------------------------------------
    // HANDLE HTTP ERRORS
    // --------------------------------------------------

    if (
        !response.ok
    ) {

        const errorText =
            await response.text();


        throw new Error(
            `OpenRouter request failed (${response.status}): ${errorText}`
        );
    }


    // --------------------------------------------------
    // READ RESPONSE
    // --------------------------------------------------

    const data =
        await response.json();


    // --------------------------------------------------
    // EXTRACT MODEL TEXT
    // --------------------------------------------------

    const text =
        extractOpenRouterText(
            data
        );


    // --------------------------------------------------
    // PARSE JSON
    // --------------------------------------------------

    const parsed =
        parseOpenRouterJson(
            text
        );


    // --------------------------------------------------
    // HANDLE RESPONSE WRAPPER
    // --------------------------------------------------

    const classifications =
        Array.isArray(
            parsed
        )
            ? parsed
            : parsed?.classifications;


    if (
        !Array.isArray(
            classifications
        )
    ) {

        throw new Error(
            "OpenRouter response did not contain a classifications array."
        );
    }


    // --------------------------------------------------
    // VALIDATE CLASSIFICATIONS
    // --------------------------------------------------

    const validated =
        validateClassification(
            classifications,
            events,
            existingFeatures,
            existingTags,
            maxTags
        );


    // --------------------------------------------------
    // RETURN VALIDATED RESULT
    // --------------------------------------------------

    return validated;
}