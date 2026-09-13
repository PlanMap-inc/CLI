// Mock for OpenRouter API: returns a single fixed response for all calls.
// Reads PLANMAP_TEST_RESPONSE env var. Use this helper when all requests
// should get the same response; use scripted-openrouter-mock.mjs if you need
// different responses on different calls.

const realFetch = globalThis.fetch;

globalThis.fetch = async function (url, options) {
    if (!String(url).includes("openrouter")) {
        return realFetch(url, options);
    }

    const response = process.env.PLANMAP_TEST_RESPONSE;

    if (response === undefined) {
        throw new Error(
            "PLANMAP_TEST_RESPONSE is required."
        );
    }

    return {
        ok: true,

        json: async () => ({
            choices: [
                {
                    message: {
                        content: response
                    }
                }
            ]
        })
    };
};
