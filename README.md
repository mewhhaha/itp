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

Wrap a registered operator token in parentheses when you need the operator
definition as a value. The parenthesized form is parser syntax and does not need
to be registered separately:

```ts
itp("(+)") === itp.get("+"); // true
```

## Custom Interpreters

Use `interpreter` with a registry of operator definitions:

```ts
import { interpreter, number_operator, operators } from "jsr:@mewhhaha/itp";

const words = interpreter(operators({
  add: number_operator(6, "left", (left, right) => left + right),
  mul: number_operator(7, "left", (left, right) => left * right),
}));

words("2 add 3 mul 4"); // 14
words("? add ?", 20, 22); // 42
```

Operator precedence follows the numeric `precedence` field: higher values bind
more tightly. `direction` controls same-precedence associativity and can be
`"left"`, `"right"`, or `"none"`.

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
- `operator(definition)` preserves a single operator definition's literal kind.
- `number_operator`, `string_operator`, `equality_operator`,
  `ordering_operator`, and `boolean_operator` create common operator
  definitions.
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
