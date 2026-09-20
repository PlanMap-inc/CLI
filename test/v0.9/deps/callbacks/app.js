function handleCredentialResponse(response) {
    console.log(response);
}

function setup() {
    google.accounts.id.initialize({
        client_id: "abc",
        callback: handleCredentialResponse
    });
}

function plain() {
    return 1 + 1;
}
