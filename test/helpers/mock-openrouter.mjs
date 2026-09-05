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
