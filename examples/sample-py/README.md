# sample-py

A tiny Python repo whose dependency graph is known by construction — the ground truth the
tree-sitter analyzer is tested against, the Python counterpart to `../sample-org`.

Oracle: `verify_token` (in `auth/tokens.py`) is used by `login` (`auth/login.py`) and
`checkout` (`billing/checkout.py`), and **not** by `browse` (`catalog/browse.py`).

Because Python has no type resolution at parse time, those cross-file call edges are
matched by symbol name and recorded as **inferred**, not certain — a strong signal the
graph is honest about, never dressed up as fact.
