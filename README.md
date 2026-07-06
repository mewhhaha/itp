# terp

Small typed expression interpreters for TypeScript and Deno.

`terp` evaluates string expressions against an operator table. Operators are not
hardcoded into the parser, so each interpreter can choose its own symbols,
words, precedence, and associativity.

## Name

A [terp](https://en.wikipedia.org/wiki/Terp) is an artificial dwelling mound
used as safe ground during storm surges, high tides, and flooding. The name is a
small nod to building your own raised little language on top of ordinary
TypeScript.

<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Hallig_Hooge_2005.jpg/640px-Hallig_Hooge_2005.jpg" alt="Terp on the Hallig of Hooge" width="520">
</p>

<p align="center">
  <sub>Image: <a href="https://commons.wikimedia.org/wiki/File:Hallig_Hooge_2005.jpg">Sandra Buhmann via Wikimedia Commons</a>, CC BY-SA 2.5.</sub>
</p>

## Install

```ts
import { terp } from "jsr:@mewhhaha/terp";
```

## Quick Start

```ts
import { terp } from "jsr:@mewhhaha/terp";

terp("2 + 3 * 4"); // 14
terp("10 - 3 - 2"); // 5
terp("true || false && false"); // true
terp("? + ?", 20, 22); // 42
terp("(1 + 2) * 3"); // 9
terp("-?0", 42); // -42
terp("!false"); // true
terp('"hello" ++ "world"'); // "helloworld"
```

When a literal expression contains placeholders and no values are passed, the
interpreter returns a reusable runner:

```ts
const add = terp("? + ?");

add(20, 22); // 42
add(1, 2); // 3
```

For expressions that come from a runtime source, use `raw`. It skips literal
type checking and returns either a reusable function or an `Error` with a
`summary` and `errors`:

```ts
const expression_from_user: string = "?0 + ?0";
const double = terp.raw(expression_from_user);

if (double instanceof Error) {
  console.error(double.summary);
  console.error(double.errors);
  throw double;
}

double(21); // 42
```

When runtime expressions are assembled from smaller pieces, validate each piece
as an interpreter fragment and compose the final expression with `raw` as a
tagged template. Template interpolations must be fragments from the same
interpreter, and the final expression is validated before a runner is returned:

```ts
// Given a custom pipeline interpreter with named values `trim` and `upper`:
const trim = pipeline.fragment("trim");
const upper = pipeline.fragment("upper");

if (trim instanceof Error || upper instanceof Error) {
  throw trim instanceof Error ? trim : upper;
}

const normalize = pipeline.raw`? | ${trim} | ${upper}`;

if (normalize instanceof Error) {
  throw normalize;
}

normalize(" hello "); // "HELLO"
```

Named placeholders read from the first value:

```ts
terp("?left + ?right * ?", { left: 2, right: 3 }, 4); // 14
```

Named placeholders only read own properties from the scope object. Prototype
properties such as `constructor` are treated as missing.

Indexed placeholders read positional values by zero-based index and can reuse
the same value:

```ts
terp("?0 + ?0", 21); // 42
terp("?1 - ?0", 20, 62); // 42
```

Wrap a registered operator token in parentheses when you need the operator
definition as a value. The parenthesized form is parser syntax and does not need
to be registered separately:

```ts
terp("(+)") === terp.get("+"); // true
```

## Custom Interpreters

Use `interpreter` with a registry of operator definitions:

```ts
import {
  interpreter,
  number_operator,
  number_unary_operator,
  operator,
} from "jsr:@mewhhaha/terp";

const words = interpreter({
  add: number_operator(6, "left", (left, right) => left + right),
  mul: number_operator(7, "left", (left, right) => left * right),
  neg: number_unary_operator(8, (value) => -value),
  "~": operator(
    number_operator(6, "left", (left, right) => left + right),
    number_unary_operator(8, (value) => -value),
  ),
});

words("2 add 3 mul 4"); // 14
words("? add ?", 20, 22); // 42
words("neg ?", 42); // -42
words("~?0 ~ ?1", 20, 62); // 42
```

Add named values when an interpreter should expose constants or functions as
part of the DSL vocabulary:

```ts
const pipeline = interpreter({
  "|": operator({
    kind: "pipe",
    precedence: 1,
    direction: "left",
    arity: 2,
    apply(value, fn) {
      if (typeof fn !== "function") {
        throw new TypeError("expected a function");
      }

      return fn(value);
    },
  }),
}, {
  values: {
    greeting: " hello ",
    trim: (value: unknown) => String(value).trim(),
    upper: (value: unknown) => String(value).toUpperCase(),
  },
});

pipeline("greeting | trim | upper"); // "HELLO"
pipeline("? | trim | upper", " hi "); // "HI"
```

Operators can run arbitrary JavaScript or TypeScript functions. The parser only
decides where the operands are; the operator body is normal code:

```ts
import {
  type BinaryOperatorDefinition,
  type InfixDirection,
  interpreter,
  type UnaryOperatorDefinition,
} from "jsr:@mewhhaha/terp";

type Guard<value> = (value: unknown) => value is value;
type UnaryFunction = (value: unknown) => unknown;

function checked_binary<const kind extends string, left, right, result>(
  kind: kind,
  precedence: number,
  direction: InfixDirection,
  left_guard: Guard<left>,
  right_guard: Guard<right>,
  fn: (left: left, right: right) => result,
): BinaryOperatorDefinition<kind, left, right, result> {
  return {
    kind,
    precedence,
    direction,
    arity: 2,
    apply(left, right) {
      if (!left_guard(left) || !right_guard(right)) {
        throw new TypeError("operator `" + kind + "` rejected an operand");
      }

      return fn(left, right);
    },
  };
}

const anything: Guard<unknown> = (_value): _value is unknown => true;
const unary_function: Guard<UnaryFunction> = (
  value,
): value is UnaryFunction => {
  return typeof value === "function";
};

const functions = interpreter({
  then: checked_binary(
    "pipe",
    1,
    "left",
    anything,
    unary_function,
    (value, fn) => fn(value),
  ),
});

const trim = (value: unknown) => String(value).trim();
const shout = (value: unknown) => String(value).toUpperCase() + "!";

functions("? then ? then ?", " hello ", trim, shout); // "HELLO!"
```

Continuing in the same file, another generic helper can keep custom DSL
operators compact while preserving runtime checks for domain values:

```ts
type Point = { x: number; y: number };

function checked_unary<const kind extends string, value, result>(
  kind: kind,
  precedence: number,
  guard: Guard<value>,
  fn: (value: value) => result,
): UnaryOperatorDefinition<kind, value, result> {
  return {
    kind,
    precedence,
    arity: 1,
    apply(value) {
      if (!guard(value)) {
        throw new TypeError("operator `" + kind + "` rejected an operand");
      }

      return fn(value);
    },
  };
}

const point: Guard<Point> = (value): value is Point => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Point>;

  return typeof candidate.x === "number" && typeof candidate.y === "number";
};

const geometry = interpreter({
  near: checked_binary(
    "geometry",
    4,
    "none",
    point,
    point,
    (left, right) => Math.hypot(left.x - right.x, left.y - right.y) <= 10,
  ),
  quadrant: checked_unary("geometry", 8, point, (value) => {
    return value.x >= 0 && value.y >= 0 ? "NE" : "other";
  }),
});

geometry("?from near ?to", {
  from: { x: 0, y: 0 },
  to: { x: 3, y: 4 },
}); // true

geometry("quadrant ?point", { point: { x: 3, y: 4 } }); // "NE"
```

Operator precedence follows the numeric `precedence` field: higher values bind
more tightly. Binary operators also set `direction` for same-precedence
associativity: `"left"`, `"right"`, or `"none"`. Unary operators are prefix
operators.

Operator definitions are generic over their operand and result types, so helper
builders can preserve signatures such as `(a -> b, a[]) -> b[]`. Expressions and
placeholders are still runtime data, so custom operators should keep guards when
they may receive untrusted values.

Operator tokens are stored on the interpreter registry and looked up with
`get(token)`. Tokens are not copied onto the callable interpreter, so custom
tokens can safely use names such as `length`, `name`, and `get`.

Operator tokens must not be empty or contain whitespace, `(`, `)`, `?`, `"`, or
`'`. Parentheses are reserved for grouping and operator values, `?` is reserved
for placeholders, and quotes are reserved for string literals.

Runtime registry validation also rejects malformed operator definitions, empty
overload sets, unsupported arities, non-finite precedence values, invalid binary
directions, and non-callable `apply` hooks.

## API

- `terp` is the default interpreter with numeric, string, equality, ordering,
  and boolean operators.
- `interpreter(registry, options?)` creates a callable interpreter from an
  operator registry, with optional named `values` for bare identifiers.
- `interpreter(...).fragment(expression)` validates a runtime expression string
  for safe composition in `raw` tagged templates.
- `interpreter(...).raw(expression)` creates a runtime expression runner or
  returns an `InterpreterError` with `summary` and `errors` when the expression
  is invalid.
- `operators(registry)` validates and preserves a reusable registry when you
  want to define it separately from `interpreter(...)`.
- `operator(definition, ...overloads)` preserves a single operator definition or
  builds an overload set for tokens with unary and binary forms.
- `number_operator`, `number_unary_operator`, `string_operator`,
  `equality_operator`, `ordering_operator`, `boolean_operator`, and
  `boolean_unary_operator` create common operator definitions.
- `standard_operators` exposes the default operator registry.

See [docs/api.md](docs/api.md) for more detail.

## Examples

The [examples](examples) folder contains small DSLs for pricing, shell-like
pipelines, approval rules, JSON-driven metric calculations, feature flags, form
validation, and applicative parser combinators. Run them all with:

```sh
deno task examples
```

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
