// `Date.now()` as a `bigint`. Prisma's `BigInt` columns cannot accept a JS
// `number` because modern engines do not implicitly widen it. The frontend
// uses `Date.now()` (a `number`) because everything there is plain JS —
// on the server we just have to do the conversion at the persistence
// boundary. This helper is the single place that knows about it.

export function now(): bigint {
  return BigInt(Date.now());
}

// `Date.now()` as a plain `number`. Use for comparisons and arithmetic
// where we never need to round-trip through Prisma. BigInt and number can
// be compared with `<` / `>` mixed, so this is mostly a readability aid.
export function nowMs(): number {
  return Date.now();
}
