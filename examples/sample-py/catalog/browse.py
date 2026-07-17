def browse(query):
    """List catalog items matching a query — unrelated to auth."""
    return [item for item in _CATALOG if query.lower() in item["name"].lower()]


_CATALOG = [
    {"name": "Widget", "price": 9},
    {"name": "Gadget", "price": 19},
]
