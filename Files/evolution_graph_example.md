# Project Evolution Graph — Worked Example
### Food Ordering Web App

> **What this document is:** a concrete example of what PlanMap's Evolution Graph looks like for a real project, and — more importantly — *how it gets that shape*, prompt by prompt.
>
> **Reminder of what the Evolution Graph is:** the record of **what actually exists**, derived by reading the code after the agent writes it. Not chat history. Not git log. Not prompt history. A node's **position** is decided only by *what it is about*; frontend/backend/security are **tags**, never structure.

---

## 1. The Placement Rule

Every prompt runs through the same 3-step test before a node is placed:

| Step | Question | Result |
|---|---|---|
| **1** | Does this clearly **extend or fix** an existing node? | → child of that node |
| **2** | Does this belong to an existing **feature**, as a new part of it? | → new child under that feature |
| **3** | Has nobody touched this capability before? | → new top-level node |

**Consequences:**
- The top level is **not** a preset list of categories. It's whatever independent capabilities have actually been built, in the order they first appeared.
- Branches grow branches, recursively. There's no depth limit.
- Classification is **semantic, not keyword**. "Improve login speed" goes under Login — *not* under a "Performance" node.

---

## 2. How the Tree Grew (prompt by prompt)

This is the part worth reading carefully — the shape is a *consequence* of the rule, not a design choice.

| # | Prompt | Test | Placement |
|---|---|---|---|
| 1 | "Build a restaurant browsing page" | Step 3 — nothing exists yet | **Browse Restaurants** (new top-level) |
| 2 | "Add search by cuisine" | Step 2 — belongs to Browse | `Browse Restaurants → Added cuisine search` |
| 3 | "Search is slow, add debounce" | Step 1 — fixes the search node | `… → Added cuisine search → Added debounce` |
| 4 | "Add login" | Step 3 — new capability | **Login** (new top-level) |
| 5 | "Add JWT verification" | Step 2 — part of Login | `Login → Added JWT auth` |
| 6 | "Tokens expire too early, fix" | Step 1 — fixes JWT | `Login → Added JWT auth → Fixed expiry bug` |
| 7 | "Add refresh tokens" | Step 1 — extends JWT | `Login → Added JWT auth → Added refresh tokens` |
| 8 | "Add a cart" | Step 3 — new capability | **Cart** (new top-level) |
| 9 | "Make the login header taller" | Step 2 — a UI detail *of Login* | `Login → Login header → Increased height` |
| 10 | "Improve login speed" | Step 2 — semantic: it's about Login | `Login → Improved response time` (**not** a "Performance" node) |
| 11 | "Add Stripe checkout" | Step 3 — new capability | **Checkout** (new top-level) |
| 12 | "Save cards for repeat orders" | Step 1 — extends Stripe | `Checkout → Stripe integration → Added saved cards` |

**Note prompt #9 especially.** A header is "frontend," but it is *not* a top-level Frontend node — it's a detail **of Login**, so it nests there. This is the rule that's easiest to get wrong.

**Note prompt #10 especially.** The word "speed" is a red herring. Semantic classification puts it under Login because that's what the change is *about*.

---

## 3. The Resulting Tree

```
Food Ordering App
│
├── Browse Restaurants                          [implemented]
│   ├── Added cuisine search                    [implemented]
│   │   └── Added debounce                      [implemented]
│   ├── Added distance sorting                  [implemented]
│   └── Restaurant card                         [implemented]
│       ├── Added rating badge                  [implemented]
│       └── Added delivery-time estimate        [implemented]
│
├── Login                                       [implemented]
│   ├── Added JWT auth                          [implemented]        (security)
│   │   ├── Fixed expiry bug                    [implemented]        (security)
│   │   └── Added refresh tokens                [implemented]        (security)
│   ├── Added email validation                  [implemented]        (security)
│   ├── Improved response time                  [implemented]        (backend)
│   ├── Login header                            [implemented]        (frontend)
│   │   ├── Increased height                    [implemented]
│   │   └── Added search bar                    [implemented]
│   │       └── Added autocomplete              [implemented]
│   └── Added remember me                       ⚠ DRIFTED            (frontend)
│
├── Cart                                        [implemented]
│   ├── Add / remove items                      [implemented]
│   ├── Quantity stepper                        [implemented]
│   └── Added promo code field                  [intended]           ← authored, no code yet
│
├── Checkout                                    [implemented]
│   ├── Stripe integration                      [implemented]        (backend)
│   │   └── Added saved cards                   [implemented]        (security)
│   ├── Address selection                       [implemented]
│   └── Order confirmation email                ⚠ ERROR              (backend)
│
└── Order Tracking                              [implemented]
    ├── Live status updates                     [implemented]        (backend)
    └── Driver map view                         [implemented]        (frontend)
```

**What to notice:**
- **Top level = 5 capabilities**, each of which appeared because a prompt introduced something genuinely new. Not "Frontend / Backend / Database."
- **Tags in parentheses are metadata**, not position. `Added JWT auth` is tagged `security` but lives under Login — where it belongs.
- **`Login header` nests inside Login**, not beside it. It's a part of Login, not a peer capability.
- **Recursion is visible:** `Login → Login header → Added search bar → Added autocomplete` is four levels deep, each level added by a separate later prompt.
- **`Added promo code field` is `intended`** — a human authored it in the Plan Graph; no code exists yet, so Evolution shows it as not-yet-real.

---

## 4. Node States

| State | Meaning | Example above |
|---|---|---|
| `intended` | Authored by a human; no code exists yet | Added promo code field |
| `approved` | Reviewed and approved; not yet implemented | — |
| `implemented` | Built; linked to real code; hash matches | most nodes |
| `drifted` | Code no longer matches what the node says it should do | Added remember me |
| `error` | Linked code is broken or missing | Order confirmation email |

---

## 5. Two Nodes, In Full

### Node: `Added refresh tokens` — a healthy leaf

```json
{
  "id": "node_0087",
  "graph": "evolution",
  "type": "element",
  "title": "Added refresh tokens",
  "parent": "node_0084",
  "status": "implemented",
  "origin": "ai_generated",
  "lens_tags": ["security", "backend"],
  "prompt": "Add refresh token support so users stay logged in",
  "summary": "Issues a long-lived refresh token alongside the JWT; /auth/refresh exchanges it for a new access token without re-authentication.",
  "linked_code": [
    { "path": "src/auth/jwt.ts",     "range": [88, 141], "hash": "c4e2a1" },
    { "path": "src/auth/refresh.ts", "range": [1, 62],   "hash": "7b90fd" }
  ],
  "depends_on": ["node_0084"],
  "depended_on_by": ["node_0091"],
  "annotation": "7-day refresh window — matches the food-delivery session pattern where users order weekly, not daily.",
  "created_at": "2026-07-06T17:48:00Z",
  "last_verified": "2026-07-16T09:00:00Z"
}
```

### Node: `Added remember me` — a drifted leaf

```json
{
  "id": "node_0102",
  "graph": "evolution",
  "type": "element",
  "title": "Added remember me",
  "parent": "node_0080",
  "status": "drifted",
  "origin": "ai_generated",
  "lens_tags": ["frontend"],
  "prompt": "Add a remember me checkbox to login",
  "summary": "Checkbox on the login form; when checked, extends session lifetime to 30 days.",
  "linked_code": [
    { "path": "src/auth/login.ts",     "range": [42, 78], "hash": "a91f33", "current_hash": "e17c08" },
    { "path": "src/ui/LoginForm.tsx",  "range": [15, 34], "hash": "5d2b41", "current_hash": "5d2b41" }
  ],
  "drift": {
    "detected_at": "2026-07-15T14:22:00Z",
    "file": "src/auth/login.ts",
    "issue": "Session lifetime is now hardcoded to 24h. The 30-day extension this node describes no longer exists in the code.",
    "likely_cause": "Modified outside PlanMap — no approved plan node corresponds to this change."
  },
  "annotation": "30-day window chosen deliberately — repeat-order behaviour is weekly.",
  "created_at": "2026-07-05T16:22:00Z",
  "last_verified": "2026-07-15T14:22:00Z"
}
```

**This is the whole thesis in one object.** Someone changed the session lifetime directly in code, outside the graph. Nothing broke. Tests pass. In a chat-based workflow this vanishes silently — and six weeks later nobody remembers there was ever a 30-day decision, or why. PlanMap flags it, and the `annotation` still holds the reason.

---

## 6. Lenses Applied to This Tree

A lens **filters** the tree by tag. It never restructures it.

**Security lens** — only security-tagged nodes, positions unchanged:
```
Food Ordering App
├── Login
│   ├── Added JWT auth
│   │   ├── Fixed expiry bug
│   │   └── Added refresh tokens
│   └── Added email validation
└── Checkout
    └── Stripe integration
        └── Added saved cards
```

**Frontend lens:**
```
Food Ordering App
├── Login
│   ├── Login header
│   │   ├── Increased height
│   │   └── Added search bar
│   │       └── Added autocomplete
│   └── Added remember me                       ⚠ DRIFTED
└── Order Tracking
    └── Driver map view
```

Same tree. Same positions. Fewer nodes.

---

## 7. Granularity Cap (why this tree stops where it does)

Per the spec: **feature → sub-feature → workflow-significant elements only.**

| Included | Excluded |
|---|---|
| `Added search bar` — the workflow depends on it | The div wrapping it |
| `Quantity stepper` — a real user action | Its padding, hover colour |
| `Order confirmation email` — a workflow step | The email template's HTML structure |
| `Added rating badge` — user-facing information | The badge's border-radius |

**Rule of thumb:** if removing it would change what a *user can do*, it's a node. If removing it only changes how something *looks*, it isn't.

Below feature level, **collapsed by default**. Any branch past ~15 nodes collapses into a summary node that opens its own view.

*Why the cap exists: element-level modelling of an entire codebase is both unreadable and the DeepWiki-hard problem. Don't fight it.*

---

## 8. What This Example Demonstrates

1. **The tree is a consequence of the rule**, not a design. Feed the same prompts in the same order to any correct implementation and you get this shape.
2. **Tags never move nodes.** `Login header` is frontend and sits under Login. `Added JWT auth` is security and sits under Login. Position = what it's *about*.
3. **Recursion is normal.** Four levels deep happens naturally after a few weeks of real work.
4. **Drift is the payoff.** The `Added remember me` node is the entire product thesis rendered as one JSON object.
5. **The `annotation` field is the moat.** "7-day refresh window — matches the food-delivery session pattern" is exactly the *why* that dies in chat history and that no git log or codebase scan can reconstruct.
