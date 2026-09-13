// Mock for OpenRouter API: returns different responses per call order from a script.
// Reads PLANMAP_MOCK_SCRIPT env var (JSON array of {classifications:[...]}, {fail:true},
// or {truncated:true}). Use this when you need to simulate different behavior on
// different OpenRouter calls; use the shared mock-openrouter.mjs for a single fixed response.

const realFetch = globalThis.fetch;

let callIndex = 0;

const script = JSON.parse(
    process.env.PLANMAP_MOCK_SCRIPT || "[]"
);

globalThis.fetch = async function (url, options) {
    if (!String(url).includes("openrouter")) {
        return realFetch(url, options);
    }

    const entry = script[callIndex];
    callIndex += 1;

    if (!entry || entry.fail) {
        return {
            ok: false,
            status: 500,
            text: async () => "stubbed upstream failure",
            json: async () => ({ error: "stubbed upstream failure" })
        };
    }

    if (entry.truncated) {
        return {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: "[{\"identity\": \"unterminated"
                        }
                    }
                ]
            })
        };
    }

    return {
        ok: true,
        json: async () => ({
            choices: [
                {
                    message: {
                        content: JSON.stringify(entry.classifications)
                    }
                }
            ]
        })
    };
};
