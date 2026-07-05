# itp

Small typed expression interpreters for TypeScript and Deno.

`itp` evaluates string expressions against an operator table. Operators are not
hardcoded into the parser, so each interpreter can choose its own symbols,
words, precedence, and associativity.

## Install

```ts
import { itp } from "jsr:@mewhhaha/itp";
```

## Quick Start

```ts
import { itp } from "jsr:@mewhhaha/itp";

itp("2 + 3 * 4"); // 14
itp("10 - 3 - 2"); // 5
itp("true || false && false"); // true
itp("? + ?", 20, 22); // 42
itp("(1 + 2) * 3"); // 9
itp("-?0", 42); // -42
itp("!false"); // true
itp('"hello" ++ "world"'); // "helloworld"
```

When a literal expression contains placeholders and no values are passed, the
interpreter returns a reusable runner:

```ts
const add = itp("? + ?");

add(20, 22); // 42
add(1, 2); // 3
```

Named placeholders read from the first value:

```ts
itp("?left + ?right * ?", { left: 2, right: 3 }, 4); // 14
```

Indexed placeholders read positional values by zero-based index and can reuse
the same value:

```ts
itp("?0 + ?0", 21); // 42
itp("?1 - ?0", 20, 62); // 42
```

Wrap a registered operator token in parentheses when you need the operator
definition as a value. The parenthesized form is parser syntax and does not need
to be registered separately:

```ts
itp("(+)") === itp.get("+"); // true
```

## Custom Interpreters

Use `interpreter` with a registry of operator definitions:

```ts
import {
  interpreter,
  number_operator,
  number_unary_operator,
  operator,
  operators,
} from "jsr:@mewhhaha/itp";

const words = interpreter(operators({
  add: number_operator(6, "left", (left, right) => left + right),
  mul: number_operator(7, "left", (left, right) => left * right),
  neg: number_unary_operator(8, (value) => -value),
  "~": operator(
    number_operator(6, "left", (left, right) => left + right),
    number_unary_operator(8, (value) => -value),
  ),
}));

words("2 add 3 mul 4"); // 14
words("? add ?", 20, 22); // 42
words("neg ?", 42); // -42
words("~?0 ~ ?1", 20, 62); // 42
```

Operator precedence follows the numeric `precedence` field: higher values bind
more tightly. Binary operators also set `direction` for same-precedence
associativity: `"left"`, `"right"`, or `"none"`. Unary operators are prefix
operators.

Operator tokens are stored on the interpreter registry and looked up with
`get(token)`. Tokens are not copied onto the callable interpreter, so custom
tokens can safely use names such as `length`, `name`, and `get`.

Operator tokens must not be empty or contain whitespace, `(`, `)`, `?`, `"`, or
`'`. Parentheses are reserved for grouping and operator values, `?` is reserved
for placeholders, and quotes are reserved for string literals.

## API

- `itp` is the default interpreter with numeric, string, equality, ordering, and
  boolean operators.
- `interpreter(registry, options?)` creates a callable interpreter from an
  operator registry.
- `operators(registry)` preserves literal token types for custom registries.
- `operator(definition, ...overloads)` preserves a single operator definition or
  builds an overload set for tokens with unary and binary forms.
- `number_operator`, `number_unary_operator`, `string_operator`,
  `equality_operator`, `ordering_operator`, `boolean_operator`, and
  `boolean_unary_operator` create common operator definitions.
- `standard_operators` exposes the default operator registry.

See [docs/api.md](docs/api.md) for more detail.

## Development

```sh
deno task ci
```

Individual tasks are available for formatting, linting, checking, tests, and a
publish dry run:

```sh
deno task fmt
deno task lint
deno task doc:lint
deno task check
deno task test
deno task publish:dry-run
```

## License

MIT
