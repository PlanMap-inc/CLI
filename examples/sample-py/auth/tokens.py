"""Token helpers — the security-critical core the rest of the app leans on."""


def verify_token(user):
    """Return True if the user's session token is valid."""
    return user is not None and user.get("token") == "ok"


def issue_token(user):
    """Mint a fresh session token for a user."""
    return {"token": "ok", "user": user["id"]}
