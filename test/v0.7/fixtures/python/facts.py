def raises_value_error():
    raise ValueError("bad input")


def catches_broad_exception():
    try:
        pass
    except Exception:
        pass


def bare_except_stub():
    try:
        pass
    except:
        pass


async def waits_and_returns_none():
    await do_work()
    return None


def has_a_numeric_literal():
    return 3.14
