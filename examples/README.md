# Examples

These examples show `terp` as a small DSL toolkit rather than only a calculator.
Run all of them with:

```sh
deno task examples
```

## `pricing_dsl.ts`

Uses word operators to make a pricing expression read like a compact business
rule.

## `functions_dsl.ts`

Shows operators that call arbitrary JavaScript functions, plus reusable generic
operator helpers that validate custom domain values with type guards.

## `bash_like_dsl.ts`

Builds a tiny shell-style pipeline DSL with `|`, prefix commands such as
`echo`/`env`, pipeline utilities registered as named values, and `raw(...)` for
a user-authored pipeline shape.

## `rules_engine.ts`

Builds an approval rules DSL with custom comparison, membership, boolean, and
prefix operators.

## `json_key_metrics.ts`

Imports `data/metrics.json`, turns configured JSON key names into named
placeholder expressions such as `?new_revenue + ?expansion_revenue`, and then
feeds each row object into the interpreter.
