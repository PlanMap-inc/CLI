from auth.tokens import verify_token


def login(user):
    if not verify_token(user):
        raise ValueError("invalid token")
    return {"ok": True, "user": user["id"]}
