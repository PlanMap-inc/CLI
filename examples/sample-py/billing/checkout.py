from auth.tokens import verify_token


def checkout(user, cart):
    if not verify_token(user):
        raise ValueError("not authorized")
    return {"charged": sum(item["price"] for item in cart), "user": user["id"]}
