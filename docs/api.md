# API Reference

## Expressions

An expression is a sequence of values separated by registered infix operators.
The runtime parser supports:

- number literals such as `1`, `3.14`, and `-2`
- boolean literals: `true` and `false`
- positional placeholders: `?`
- named placeholders: `?name`
- parenthesized operator values such as `(+)` and `(add)`
- operators from the interpreter registry

Whitespace is optional around symbolic operators and useful around word
operators.

## `itp`

```ts
import { itp } from "jsr:@mewhhaha/itp";
```

The default interpreter includes:

- number operators: `+`, `-`, `*`, `/`, `%`
- equality operators: `==`, `!=`
- ordering operators: `<`, `<=`, `>`, `>=`
- boolean operators: `&&`, `||`

Examples:

```ts
itp("2 + 3 * 4"); // 14
itp("? + ?", 20, 22); // 42

const add = itp("? + ?");
add(1, 2); // 3

itp("(+)") === itp.get("+"); // true
```

## `interpreter`

```ts
const calc = interpreter(registry, options);
```

Creates a callable interpreter and attaches the supplied operators to it. The
returned value also exposes:

- `calc.operators`
- `calc.get(token)`
- each operator from the registry as a property

`options.apply_operator` can replace the default operator application step:

```ts
const traced = interpreter(standard_operators, {
  apply_operator(operator, left, right) {
    console.log(operator.token, left, right);
    return operator.definition.apply(left, right);
  },
});
```

## Operator Definitions

Every operator definition has this shape:

```ts
interface OperatorDefinition<kind extends string = string> {
  readonly kind: kind;
  readonly precedence: number;
  readonly direction: "left" | "right" | "none";
  readonly arity: 2;
  readonly apply: (left: unknown, right: unknown) => unknown;
}
```

Higher precedence values bind more tightly. Operators with the same precedence
must have the same associativity. `"none"` prevents chaining at the same
precedence.

Register only the infix token itself. For example, registering `+` also allows
`(+)` as an operator value expression; `"(+)"` is not a separate registry key.

Helper constructors:

- `operator(definition)`
- `number_operator(precedence, direction, fn)`
- `equality_operator(fn?)`
- `ordering_operator(fn)`
- `boolean_operator(precedence, direction, fn)`

## Registry Helpers

`operators` preserves literal token types for custom registries:

```ts
const registry = operators({
  add: number_operator(6, "left", (left, right) => left + right),
});
```

Lookup and narrowing helpers:

- `get_operator_from(operators, token)`
- `has_operator_kind(operators, token, kind)`
- `first_operator_token(operators, kind)`
