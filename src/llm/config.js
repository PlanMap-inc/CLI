import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


// --------------------------------------------------
// WHERE .env IS LOOKED FOR
// --------------------------------------------------
// The directory you are standing in, and then PlanMap's own. Only the first
// was checked once, and running PlanMap against a repo somewhere else meant
// no .env was found at all - so the endpoint, the model and the key all fell
// back, and the fallback is a local Ollama. Every batch then failed against
// a server that was never running, while the configuration sat in PlanMap's
// own directory the whole time.
//
// The key follows the tool, because that is where it was set up. cwd still
// wins, so a project can override it, and the environment wins over both.
// --------------------------------------------------

const PLANMAP_ROOT =
    path.resolve(
        path.dirname(
            fileURLToPath(import.meta.url)
        ),
        "..",
        ".."
    );


function envPaths() {
    const paths = [
        path.resolve(process.cwd(), ".env"),
        path.join(PLANMAP_ROOT, ".env")
    ];

    return [...new Set(paths)];
}


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
    for (
        const envPath of envPaths()
    ) {
        const value =
            readFromEnvFile(
                envPath,
                name
            );

        if (
            value
        ) {
            return value;
        }
    }

    return null;
}


function readFromEnvFile(
    envPath,
    name
) {
    let text;

    try {
        text =
            fs.readFileSync(
                envPath,
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


// An environment variable that is SET wins, even when it is empty. Setting
// it empty is how you say "none" out loud - "OPENROUTER_API_KEY= planmap
// draft ." forces the no-key path - and without it there is no way to
// override a .env downwards, only upwards.
function fromEnvironment(
    name
) {
    if (
        !Object.hasOwn(process.env, name)
    ) {
        return undefined;
    }

    return (
        process.env[name]?.trim() ||
        null
    );
}


function setting(
    name
) {
    const fromEnv =
        fromEnvironment(name);

    if (
        fromEnv !== undefined
    ) {
        return fromEnv;
    }

    return (
        readEnvFile(name) ||
        null
    );
}

export function loadLlmApiKey() {

    // The environment wins, in the order KEY_NAMES lists. A name set to an
    // empty string is an answer - "no key" - and stops the search, so a
    // .env cannot put one back.
    for (
        const name of KEY_NAMES
    ) {
        const fromEnv =
            fromEnvironment(name);

        if (
            fromEnv !== undefined
        ) {
            return fromEnv;
        }
    }


    // Then the .env files, which readEnvFile searches in the same order as
    // every other setting: where you are standing, then PlanMap's own
    // directory. This used to parse .env a second time, and only ever
    // looked in the current directory.
    for (
        const name of KEY_NAMES
    ) {
        const value =
            readEnvFile(name);

        if (
            value
        ) {
            return value;
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
// OpenAI-compatible server:
//
//   PLANMAP_LLM_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
//   PLANMAP_LLM_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
//   OPENROUTER_API_KEY=...   (hosted providers need a key; local ones do not)
//
// --------------------------------------------------
// AND A KEY IS ITSELF AN ANSWER
// --------------------------------------------------
// Setting up a key is how a person says which provider they use. Pointing
// them at Ollama anyway means a key that does nothing until they also find
// PLANMAP_LLM_ENDPOINT, and every run until then fails against a server
// they never started.
//
// So the endpoint is chosen in three steps:
//
//   1. an explicit PLANMAP_LLM_ENDPOINT - or the VS Code setting, which
//      reaches this as the same variable - always wins
//   2. otherwise, a key that is actually available means OpenRouter
//   3. otherwise, the local Ollama default
//
// A key set to an EMPTY string is not a key. It is how you say "stay
// offline" out loud, and it still means no model.
// --------------------------------------------------

const DEFAULT_ENDPOINT =
    "http://localhost:11434/v1/chat/completions";

const DEFAULT_MODEL =
    "qwen2.5-coder:7b";

const OPENROUTER_ENDPOINT =
    "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_MODEL =
    "nvidia/nemotron-3-ultra-550b-a55b:free";


// Exported so the choice can be tested on its own. LLM_ENDPOINT and
// LLM_MODEL are read once when this module is first imported, so a test
// that varied the environment would otherwise have to re-import it.
export function chooseProvider(
    {
        endpoint = null,
        model = null,
        apiKey = null
    } = {}
) {
    if (
        endpoint
    ) {
        return {
            endpoint,
            model: model || DEFAULT_MODEL
        };
    }

    if (
        apiKey
    ) {
        return {
            endpoint: OPENROUTER_ENDPOINT,
            model: model || OPENROUTER_MODEL
        };
    }

    return {
        endpoint: DEFAULT_ENDPOINT,
        model: model || DEFAULT_MODEL
    };
}


const PROVIDER =
    chooseProvider({
        endpoint:
            setting("PLANMAP_LLM_ENDPOINT"),

        model:
            setting("PLANMAP_LLM_MODEL"),

        apiKey:
            loadLlmApiKey()
    });


export const LLM_ENDPOINT =
    PROVIDER.endpoint;


export const LLM_MODEL =
    PROVIDER.model;


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