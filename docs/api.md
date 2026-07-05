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
- parenthesized operator values such as `(+)` and `(add)`
- grouped expressions such as `(1 + 2) * 3`
- prefix and infix operators from the interpreter registry

Whitespace is optional around symbolic operators and useful around word
operators.

Number literal support follows TypeScript's `${number}` string shape for finite
numbers, including decimal, scientific, hexadecimal, binary, and octal forms.
String literals support escapes for `\\`, `\"`, `\'`, `\n`, `\r`, and `\t`.

## `itp`

```ts
import { itp } from "jsr:@mewhhaha/itp";
```

The default interpreter includes:

- number operators: `+`, `-`, `*`, `/`, `%`
- string operators: `++`
- equality operators: `==`, `!=`
- ordering operators: `<`, `<=`, `>`, `>=`
- boolean operators: `!`, `&&`, `||`

Examples:

```ts
itp("2 + 3 * 4"); // 14
itp("? + ?", 20, 22); // 42
itp("?0 + ?0", 21); // 42
itp("(1 + 2) * 3"); // 9
itp("-?0", 42); // -42
itp("!false"); // true
itp('"hello" ++ "world"'); // "helloworld"

const add = itp("? + ?");
add(1, 2); // 3

itp("(+)") === itp.get("+"); // true
```

Indexed placeholders are zero-based and can reuse the same value. They advance
the positional placeholder cursor past the referenced index, so `?0 + ?` reads
the first and second positional values.

## `interpreter`

```ts
const calc = interpreter(registry, options);
```

Creates a callable interpreter from the supplied operator registry. The returned
value also exposes:

- `calc.operators`
- `calc.get(token)`

Operator tokens are not copied onto the callable interpreter as properties. This
keeps tokens such as `get`, `name`, and `length` safe to use in a registry.

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
interface UnaryOperatorDefinition<kind extends string = string> {
  readonly kind: kind;
  readonly precedence: number;
  readonly arity: 1;
  readonly apply: (value: unknown) => unknown;
}

interface BinaryOperatorDefinition<kind extends string = string> {
  readonly kind: kind;
  readonly precedence: number;
  readonly arity: 2;
  readonly direction: "left" | "right" | "none";
  readonly apply: (left: unknown, right: unknown) => unknown;
}
```

Higher precedence values bind more tightly. Binary operators with the same
precedence must have the same associativity. `"none"` prevents chaining at the
same precedence. Unary operators are prefix operators.

Register only the infix token itself. For example, registering `+` also allows
`(+)` as an operator value expression; `"(+)"` is not a separate registry key.

Operator tokens must not be empty or contain whitespace, `(`, `)`, `?`, `"`, or
`'`. Parentheses are reserved for grouping and operator values, `?` is reserved
for placeholders, and quotes are reserved for string literals.

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

`operators` preserves literal token types for custom registries:

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
