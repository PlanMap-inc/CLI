import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// LOAD THE API KEY
// --------------------------------------------------
// 1-Checks process.env first.
// 2-Falls back to the project .env file.
// 3-Returns the API key when found.
// 4-Returns null when the key is unavailable.
//
// PLANMAP_LLM_API_KEY is the provider-neutral name: the endpoint may be
// OpenRouter, Google, Groq, or anything else OpenAI-compatible.
// OPENROUTER_API_KEY still works, and wins when both are set, so nothing
// that already relies on it changes.
// --------------------------------------------------

// The provider-neutral name is checked first: when both are set, the one
// named after the endpoint in use should win, and OPENROUTER_API_KEY is
// often left behind from an earlier provider.
const KEY_NAMES = [
    "PLANMAP_LLM_API_KEY",
    "OPENROUTER_API_KEY"
];


// --------------------------------------------------
// READ THE PROJECT .env
// --------------------------------------------------
// The endpoint and the model are read when this module is first imported,
// before a command can load .env itself, so .env is read here too. The
// environment always wins.
// --------------------------------------------------

function readEnvFile(
    name
) {
    let text;

    try {
        text =
            fs.readFileSync(
                path.resolve(
                    process.cwd(),
                    ".env"
                ),
                "utf8"
            );
    } catch {
        return null;
    }

    for (
        const line
        of text.split(/\r?\n/)
    ) {
        const trimmed =
            line.trim();

        if (
            !trimmed.startsWith(
                `${name}=`
            )
        ) {
            continue;
        }

        const value =
            trimmed
                .slice(
                    name.length + 1
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

    return null;
}


function setting(
    name
) {
    return (
        process.env[name]?.trim() ||
        readEnvFile(name) ||
        null
    );
}

export function loadLlmApiKey() {

    for (
        const name of KEY_NAMES
    ) {
        if (
            process.env[name]
        ) {
            return process.env[name].trim();
        }
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


        const name =
            KEY_NAMES.find(
                candidate =>
                    trimmed.startsWith(
                        `${candidate}=`
                    )
            );


        if (
            name
        ) {

            const value =
                trimmed
                    .slice(
                        name.length + 1
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

// --------------------------------------------------
// LLM PROVIDER
// --------------------------------------------------
// A local model by default: free, unlimited, and nothing leaves the
// machine. Start it with:
//
//   ollama serve            (OLLAMA_CONTEXT_LENGTH=16384 for full batches)
//   ollama pull qwen2.5-coder:7b
//
// PLANMAP_LLM_ENDPOINT and PLANMAP_LLM_MODEL point PlanMap at any other
// OpenAI-compatible server, such as OpenRouter:
//
//   PLANMAP_LLM_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
//   PLANMAP_LLM_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
//   OPENROUTER_API_KEY=...   (hosted providers need a key; local ones do not)
// --------------------------------------------------

const DEFAULT_ENDPOINT =
    "http://localhost:11434/v1/chat/completions";

const DEFAULT_MODEL =
    "qwen2.5-coder:7b";


export const LLM_ENDPOINT =
    setting("PLANMAP_LLM_ENDPOINT") ||
    DEFAULT_ENDPOINT;


export const LLM_MODEL =
    setting("PLANMAP_LLM_MODEL") ||
    DEFAULT_MODEL;


// A model served on this machine needs no API key.
export function isLocalLlm(
    endpoint = LLM_ENDPOINT
) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(
        String(endpoint)
    );
}


// Ollama's context window is fixed when its server starts (4096 by default),
// and its OpenAI-compatible endpoint cannot change it. Its own /api/chat can,
// per request, so PlanMap uses that for a local Ollama: a full batch and its
// reply need far more room than 4096 tokens.
export const LLM_NUM_CTX =
    Number.parseInt(
        process.env.PLANMAP_LLM_NUM_CTX ?? "",
        10
    ) > 0
        ? Number.parseInt(
            process.env.PLANMAP_LLM_NUM_CTX,
            10
        )
        : 16384;


export function ollamaChatEndpoint(
    endpoint = LLM_ENDPOINT
) {
    const match =
        /^(https?:\/\/[^/]+)\/v1\/chat\/completions\/?$/i.exec(
            String(endpoint)
        );

    if (
        !match ||
        !isLocalLlm(endpoint)
    ) {
        return null;
    }

    return `${match[1]}/api/chat`;
}


// Whether a classification request can be made at all.
export function llmAvailable() {

    if (
        isLocalLlm()
    ) {
        return true;
    }


    // An empty OPENROUTER_API_KEY is a deliberate "stay offline", and
    // must not be overridden by the project's .env file.
    const explicit =
        process.env.OPENROUTER_API_KEY;

    if (
        explicit !== undefined &&
        explicit.trim() === ""
    ) {
        return false;
    }


    return Boolean(
        loadLlmApiKey()
    );
}