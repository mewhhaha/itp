import { assert_equals, assert_true } from "./assert.ts";
import { interpreter, op } from "../mod.ts";

Deno.test("op creates operator definitions from fixity declarations", () => {
  const calc = interpreter({
    add: op("infixl 6 ?", (left: number, right: number) => left + right),
    mul: op("infixl 7 ?", (left: number, right: number) => left * right),
    neg: op("prefix 8 ?", (value: number) => -value),
  });

  assert_equals(calc("2 add 3 mul 4"), 14);
  assert_equals(calc("neg 2 add 3"), 1);

  const add = calc.get("add");

  assert_true(
    add !== undefined && !Array.isArray(add),
    "expected add operator",
  );
  assert_equals(add.kind, "operator");
  assert_equals(add.arity, 2);

  if (add.arity === 2) {
    assert_equals(add.direction, "left");
    assert_equals(add.precedence, 6);
  }
});

Deno.test("op supports associativity declarations and custom kinds", () => {
  const equal = op("infix 4 ?", () => true);
  const right = op("infixr 5 ?", (left: string, right: string) => left + right);
  const text = op("prefix 8 ?", String, { kind: "text" });
  const inline_text = op('"text" | prefix 8 ?', String);
  const shell_op = op.kind("shell");
  const pipe = op("'shell' | infixl 1 ?", (
    value: unknown,
    command: (input: unknown) => unknown,
  ) => command(value));
  const inline_kind_wins = shell_op("'math' | infixl 6 ?", (
    left: number,
    right: number,
  ) => left + right);

  assert_equals(equal.kind, "operator");
  assert_equals(equal.arity, 2);
  assert_equals(equal.direction, "none");
  assert_equals(right.arity, 2);
  assert_equals(right.direction, "right");
  assert_equals(text.kind, "text");
  assert_equals(text.arity, 1);
  assert_equals(inline_text.kind, "text");
  assert_equals(inline_text.arity, 1);
  assert_equals(pipe.kind, "shell");
  assert_equals(pipe.arity, 2);
  assert_equals(pipe.direction, "left");
  assert_equals(inline_kind_wins.kind, "math");
});

Deno.test("op rejects malformed declarations", () => {
  assert_throws(
    () => op("infixl 6", () => undefined),
    "must end with `?`",
  );
  assert_throws(
    () => op("between 6 ?", () => undefined),
    "is invalid",
  );
  assert_throws(
    () => op("6 ?", () => undefined),
    "must be `prefix`, `infix`, `infixl`, or `infixr`",
  );
  assert_throws(
    () => op("1 | infixl 6 ?", () => undefined),
    "kind must be a string",
  );
});

const expect_operator_dsl_type_errors = () => {
  const arrays = interpreter({
    map: op("infixl 5 ?", (
      fn: (value: number) => string,
      values: readonly number[],
    ): string[] => values.map(fn)),
  });
  const mapped = arrays("? map ?");
  const mapped_result: string[] = mapped((value) => String(value), [1, 2]);
  const math = op("infixl 6 ?", (
    left: number,
    right: number,
  ): number => left + right, { kind: "math" });
  const math_kind: "math" = math.kind;
  const inline_math = op("'math' | infixl 6 ?", (
    left: number,
    right: number,
  ): number => left + right);
  const inline_math_kind: "math" = inline_math.kind;
  const shell = op.kind("shell");
  const trim = shell("prefix 8 ?", (value: string): string => value.trim());
  const inline_trim = shell("'text' | prefix 8 ?", (
    value: string,
  ): string => value.trim());
  const shell_kind: "shell" = trim.kind;
  const inline_trim_kind: "text" = inline_trim.kind;

  // @ts-expect-error The mapper input must accept the array element type.
  mapped((value: string) => value, [1, 2]);
  // @ts-expect-error The mapped values must be numbers.
  mapped((value) => String(value), ["x"]);
  // @ts-expect-error The operator kind is the configured literal.
  const wrong_kind: "operator" = math.kind;

  void mapped_result;
  void math_kind;
  void inline_math_kind;
  void shell_kind;
  void inline_trim_kind;
  void wrong_kind;
};

void expect_operator_dsl_type_errors;

function assert_throws(fn: () => unknown, message: string): void {
  try {
    fn();
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw new Error("expected a TypeError");
    }

    assert_true(
      error.message.includes(message),
      "expected error message to include `" + message + "` but got `" +
        error.message + "`",
    );
    return;
  }

  throw new Error("expected function to throw");
}
