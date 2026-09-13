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
