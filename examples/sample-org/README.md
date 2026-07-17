# sample-org

A tiny synthetic TypeScript "app" used as PlanMap's demo and its accuracy
regression corpus. The dependency structure is deliberately known, so tests can
assert impact analysis catches exactly the right things and never invents an edge.

## Known dependency structure (the oracle)

- `src/auth/jwt.ts`
  - `verifyToken` ← called by `src/auth/login.ts` (`login`) **and**
    `src/checkout/checkout.ts` (`checkout`)
  - `issueToken` ← called by `src/auth/reset.ts` (`requestReset`)
- `src/cart/cart.ts`
  - `addItem` ← called by `src/checkout/checkout.ts` (`checkout`)

So **editing `verifyToken` should surface `login` and `checkout` as affected**
(and nothing else), with an `auth` risk flag. Nothing depends on `requestReset`.
