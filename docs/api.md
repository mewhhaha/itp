# API Reference

## Expressions

An expression is a sequence of values separated by registered infix operators.
The runtime parser supports:

- number literals such as `1`, `3.14`, and `-2`
- string literals such as `"hello"` and `'world'`
- boolean literals: `true` and `false`
- positional placeholders: `?`
- indexed placeholders: `?0`, `?1`, `?2`
- named placeholders: `?name`
- named values from the interpreter, such as `trim` or `HOME`
- parenthesized operator values such as `(+)` and `(add)`
- grouped expressions such as `(1 + 2) * 3`
- prefix and infix operators from the interpreter registry

Whitespace is optional around symbolic operators and useful around word
operators.

Number literal support follows TypeScript's `${number}` string shape for finite
numbers, including decimal, scientific, hexadecimal, binary, and octal forms.
String literals support escapes for `\\`, `\"`, `\'`, `\n`, `\r`, and `\t`.

## `terp`

```ts
import { terp } from "jsr:@mewhhaha/terp";
```

The default interpreter includes:

- number operators: `+`, `-`, `*`, `/`, `%`
- string operators: `++`
- equality operators: `==`, `!=`
- ordering operators: `<`, `<=`, `>`, `>=`
- boolean operators: `!`, `&&`, `||`

Examples:

```ts
terp("2 + 3 * 4"); // 14
terp("? + ?", 20, 22); // 42
terp("?0 + ?0", 21); // 42
terp("(1 + 2) * 3"); // 9
terp("-?0", 42); // -42
terp("!false"); // true
terp('"hello" ++ "world"'); // "helloworld"

const add = terp("? + ?");
add(1, 2); // 3

terp("(+)") === terp.get("+"); // true
```

Indexed placeholders are zero-based and can reuse the same value. They advance
the positional placeholder cursor past the referenced index, so `?0 + ?` reads
the first and second positional values.

## `interpreter`

```ts
const calc = interpreter({
  add: number_operator(6, "left", (left, right) => left + right),
  neg: number_unary_operator(8, (value) => -value),
}, {
  values: {
    answer: 42,
  },
});
```

Creates a callable interpreter from the supplied operator registry. You can pass
a plain object directly; `operators(...)` is only needed when you want to define
and validate a reusable registry separately. Use `options.values` to expose
named constants or functions as bare identifiers in expressions. The returned
value also exposes:

- `calc.operators`
- `calc.values`
- `calc.get(token)`
- `calc.get_value(name)`
- `calc.fragment(expression)`
- `calc.raw(expression)`

Operator tokens are not copied onto the callable interpreter as properties. This
keeps tokens such as `get`, `name`, and `length` safe to use in a registry.
Named values are also kept in `calc.values` rather than copied onto the callable
interpreter.

Bare named values are interpreter-level vocabulary. Named placeholders remain
per-call data:

```ts
const calc = interpreter({
  "+": number_operator(6, "left", (left, right) => left + right),
}, {
  values: {
    one: 1,
  },
});

calc("one + ?value", { value: 41 }); // 42
calc.get_value("one"); // 1
```

Named placeholders read only own properties from the scope object. Inherited
prototype properties such as `constructor` are treated as missing.

Value names must be valid identifiers, cannot be `true` or `false`, and cannot
conflict with an operator token.

`raw` is for expressions that are only known at runtime, such as user-authored
DSL strings. It returns either an `InterpreterError` or a function with
`(...args: unknown[]) => unknown` instead of using literal-type syntax checks:

```ts
const expression_from_user: string = "?0 + ?0";
const double = calc.raw(expression_from_user);

if (double instanceof Error) {
  console.error(double.summary);
  console.error(double.errors);
  throw double;
}

double(21); // 42
```

Use `fragment` when runtime-authored pieces need to be validated before being
assembled into a larger expression. Fragments stringify to their original
expression, but `raw` also works as a tagged template and rejects interpolations
that are not fragments from the same interpreter:

```ts
const left = calc.fragment("?0 add ?1");
const right = calc.fragment("answer");

if (left instanceof Error || right instanceof Error) {
  throw left instanceof Error ? left : right;
}

const runner = calc.raw`${left} add ${right}`;

if (runner instanceof Error) {
  throw runner;
}

runner(20, 22); // 84
```

The final composed expression is validated before `raw` returns a runner, so a
bad combination still returns an `InterpreterError`.

`options.apply_operator` can replace the default operator application step:

```ts
const traced = interpreter(standard_operators, {
  apply_operator(operator, ...operands) {
    console.log(operator.token, operands);

    switch (operator.definition.arity) {
      case 1:
        return operator.definition.apply(operands[0]);
      case 2:
        return operator.definition.apply(operands[0], operands[1]);
    }
  },
});
```

## Operator Definitions

Unary and binary operator definitions share `kind`, `precedence`, and `arity`.
Binary definitions also include associativity:

```ts
interface UnaryOperatorDefinition<
  kind extends string = string,
  value = unknown,
  result = unknown,
> {
  readonly kind: kind;
  readonly precedence: number;
  readonly arity: 1;
  apply(value: value): result;
}

interface BinaryOperatorDefinition<
  kind extends string = string,
  left = unknown,
  right = unknown,
  result = unknown,
> {
  readonly kind: kind;
  readonly precedence: number;
  readonly arity: 2;
  readonly direction: "left" | "right" | "none";
  apply(left: left, right: right): result;
}
```

The generic operand and result parameters let reusable operator builders expose
their domain types. For example, a map-style operator can be typed as
`BinaryOperatorDefinition<"map", (value: A) => B, readonly A[], readonly B[]>`.
Keep runtime guards in custom operators when expression strings or placeholders
can supply values from untyped sources.

Higher precedence values bind more tightly. Binary operators with the same
precedence must have the same associativity. `"none"` prevents chaining at the
same precedence. Unary operators are prefix operators.

Register only the infix token itself. For example, registering `+` also allows
`(+)` as an operator value expression; `"(+)"` is not a separate registry key.

Operator tokens must not be empty or contain whitespace, `(`, `)`, `?`, `"`, or
`'`. Parentheses are reserved for grouping and operator values, `?` is reserved
for placeholders, and quotes are reserved for string literals.

Runtime registry validation rejects empty overload sets, malformed definitions,
unsupported arities, non-finite precedence values, invalid binary directions,
and non-callable `apply` hooks.

Helper constructors:

- `operator(definition, ...overloads)`
- `unary_operator(kind, precedence, fn)`
- `number_operator(precedence, direction, fn)`
- `number_unary_operator(precedence, fn)`
- `string_operator(precedence, direction, fn)`
- `equality_operator(fn?)`
- `ordering_operator(fn)`
- `boolean_operator(precedence, direction, fn)`
- `boolean_unary_operator(precedence, fn)`

## Registry Helpers

`operators` validates a registry while preserving literal token types. It is
useful when a registry is shared, exported, or composed before being passed to
`interpreter(...)`:

```ts
const registry = operators({
  add: number_operator(6, "left", (left, right) => left + right),
  neg: number_unary_operator(8, (value) => -value),
  "~": operator(
    number_operator(6, "left", (left, right) => left + right),
    number_unary_operator(8, (value) => -value),
  ),
});
```

Lookup and narrowing helpers:

- `get_operator_from(registry, token)`
- `has_operator_kind(registry, token, kind)`
- `first_operator_token(registry, kind)`
