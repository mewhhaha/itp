import { assert_equals, assert_true } from "./assert.ts";
import {
  boolean_unary_operator,
  first_operator_token,
  get_operator_from,
  has_operator_kind,
  interpreter,
  InterpreterError,
  itp,
  number_operator,
  number_unary_operator,
  operator,
  operators,
  type RawStringRunner,
  standard_operators,
  type StandardOperators,
  string_operator,
  type StringRunner,
  unary_operator,
} from "../mod.ts";

Deno.test("interpreter evaluates registered infix operators with precedence", () => {
  assert_equals(itp("2 + 3 * 4"), 14);
  assert_equals(itp("10 - 3 - 2"), 5);
  assert_equals(itp("true || false && false"), true);
});

Deno.test("interpreter accepts plain registry objects", () => {
  const word_itp = interpreter({
    add: number_operator(6, "left", add),
    neg: number_unary_operator(8, (value) => -value),
  });

  assert_equals(word_itp("20 add 22"), 42);
  assert_equals(word_itp("neg 42"), -42);
  assert_equals(word_itp.get("add"), word_itp.operators.add);
});

Deno.test("interpreter accepts whitespace wherever token boundaries allow it", () => {
  assert_equals(itp(" \t\n 2 \n + \t 3 \r\n * 4 \t "), 14);
  assert_equals(itp("(\n1 + 2\n) *\t3"), 9);
  assert_equals(itp("!\nfalse"), true);

  const word_itp = interpreter(operators({
    add: number_operator(6, "left", add),
    neg: number_unary_operator(8, (value) => -value),
  }));

  assert_equals(word_itp("neg\n20 add\t62"), 42);
});

Deno.test("interpreter parses standalone literals without coercion", () => {
  assert_equals(itp("0"), 0);
  assert_equals(itp("-0"), -0);
  assert_equals(itp("+1.5"), 1.5);
  assert_equals(itp("true"), true);
  assert_equals(itp("false"), false);
  assert_equals(itp('"hello"'), "hello");
  assert_equals(itp("'hello'"), "hello");
});

Deno.test("interpreter preserves standard arithmetic and boolean expectations", () => {
  assert_equals(itp("8 / 2 % 3"), 1);
  assert_equals(itp("2 + 3 * -4"), -10);
  assert_equals(itp("--2"), 2);
  assert_equals(itp("2*-3"), -6);
  assert_equals(itp("1--2"), 3);
  assert_equals(itp("!(true || false)"), false);
  assert_equals(itp("!true || true"), true);
  assert_equals(itp("1 < 2 && 2 < 3"), true);
  assert_equals(itp("(1 < 2) == true"), true);
});

Deno.test("interpreter supports placeholders named references and runners", () => {
  const add = itp("? + ?");
  const double_first = itp("?0 + ?0");
  const named_runner = itp("?left + ?");
  const named = itp("?left + ?right * ?", {
    left: 2,
    right: 3,
  }, 4);

  assert_equals(add(20, 22), 42);
  assert_equals(double_first(21), 42);
  assert_equals(named, 14);
  assert_equals(itp("? + ?", 20, 22), 42);
  assert_equals(itp("?0 + ?0", 21), 42);
  assert_equals(itp("?1 - ?0", 20, 62), 42);
  assert_equals(itp("?2", "first", "second", "third"), "third");
  assert_equals(itp("?0 + ?", 20, 22), 42);
  assert_equals(itp("(?1 - ?0) * ?0", 2, 23), 42);
  assert_equals(itp("?left + ?0", { left: 20 }, 22), 42);
  assert_equals(itp("?0 + ?left", { left: 22 }, 20), 42);
  assert_equals(itp("?left + ?", { left: 20 }, 22), 42);
  assert_equals(named_runner({ left: 20 }, 22), 42);
});

Deno.test("interpreter raw creates runners from dynamic expression strings", () => {
  const double_expression: string = "?0 + ?0";
  const double = assert_raw_runner(itp.raw(double_expression));
  const named = assert_raw_runner(itp.raw("?left + ?"));
  const literal = assert_raw_runner(itp.raw("1 + 2 * 3"));

  assert_equals(double(21), 42);
  assert_equals(named({ left: 20 }, 22), 42);
  assert_equals(literal(), 7);
  assert_equals(
    assert_raw_runner(itp.raw('"hello" ++ " " ++ ?'))("world"),
    "hello world",
  );
  assert_type_error_message(
    () => named({}, 22),
    "scope is missing `left`",
    "raw runners should still report runtime argument errors",
  );
});

Deno.test("interpreter raw returns errors for invalid dynamic strings", () => {
  const trailing = itp.raw("1 +");
  const unknown = itp.raw("? ** ?");
  const bad_group = itp.raw("(1 + 2");
  const bad_placeholder = itp.raw("?999999999999999999999");

  assert_true(
    trailing instanceof Error,
    "raw errors should still be Error instances",
  );
  assert_equals(
    assert_raw_error(trailing, "trailing operators should fail raw").summary,
    "expression is missing a value",
  );
  assert_equals(
    assert_raw_error(unknown, "unknown operators should fail raw").summary,
    "expected a registered operator at `** ?`",
  );
  assert_equals(
    assert_raw_error(bad_group, "unclosed groups should fail raw").summary,
    "expression is missing `)`",
  );
  assert_equals(
    assert_raw_error(
      bad_placeholder,
      "unsafe placeholder indexes should fail raw",
    ).summary,
    "placeholder index `999999999999999999999` is too large",
  );
  assert_true(
    assert_raw_error(trailing, "trailing operators should fail raw")
      .cause instanceof
      TypeError,
    "raw errors should retain the underlying cause",
  );
});

Deno.test("interpreter raw validates syntax without operand type checks", () => {
  const string_plus = itp.raw('"hello" + "world"');
  const dynamic_number = itp.raw("? + ?");

  assert_true(
    !(string_plus instanceof Error),
    "raw should not run operator type checks during validation",
  );
  assert_true(
    !(dynamic_number instanceof Error),
    "placeholder operators should validate without concrete values",
  );
  const string_plus_runner = assert_raw_runner(string_plus);

  assert_type_error_message(
    () => string_plus_runner(),
    "expected a number",
    "operator type errors should still happen when raw runners execute",
  );
});

Deno.test("interpreter uses only the operators registered on the instance", () => {
  const word_itp = interpreter(operators({
    add: number_operator(6, "left", (left, right) => left + right),
    mul: number_operator(7, "left", (left, right) => left * right),
  }));
  const inverted_itp = interpreter(operators({
    add: number_operator(9, "left", (left, right) => left + right),
    mul: number_operator(6, "left", (left, right) => left * right),
  }));

  assert_equals(word_itp.get("+"), undefined);
  assert_equals(word_itp("2 add 3 mul 4"), 14);
  assert_equals(inverted_itp("2 add 3 mul 4"), 20);
});

Deno.test("interpreter keeps operators in the registry instead of callable properties", () => {
  const odd_itp = interpreter(operators({
    custom: number_operator(6, "left", (left, right) => left + right),
    get: number_operator(6, "left", (left, right) => left + right),
    length: number_operator(6, "left", (left, right) => left + right),
    name: number_operator(6, "left", (left, right) => left + right),
  }));

  assert_equals(Object.hasOwn(odd_itp, "custom"), false);
  assert_equals(Object.hasOwn(odd_itp, "get"), true);
  assert_equals(Object.hasOwn(odd_itp, "length"), true);
  assert_equals(Object.hasOwn(odd_itp, "name"), true);
  assert_equals(typeof odd_itp.get, "function");
  assert_equals(odd_itp.get("get"), odd_itp.operators.get);
  assert_equals(odd_itp("1 custom 2 get 3 length 4 name 5"), 15);
});

Deno.test("operator registry helpers work with single definitions and overloads", () => {
  assert_equals(get_operator_from(standard_operators, "+"), itp.get("+"));
  assert_equals(has_operator_kind(standard_operators, "+", "number"), true);
  assert_equals(has_operator_kind(standard_operators, "++", "string"), true);
  assert_equals(has_operator_kind(standard_operators, "!", "boolean"), true);
  assert_equals(
    has_operator_kind(standard_operators, "missing", "number"),
    false,
  );
  assert_equals(first_operator_token(standard_operators, "string"), "++");

  const overloaded = itp.get("-");

  assert_true(
    Array.isArray(overloaded),
    "overloaded standard '-' should expose unary and binary definitions",
  );
  assert_equals(has_operator_kind(standard_operators, "-", "number"), true);
});

Deno.test("operator registries reject tokens that conflict with parser syntax", () => {
  assert_true(
    catch_type_error(() => operators({ "": number_operator(1, "left", add) }))
      .message.includes("must not be empty"),
    "empty operators should be rejected",
  );
  assert_true(
    catch_type_error(() =>
      operators({ "bad token": number_operator(1, "left", add) })
    ).message.includes("must not contain whitespace"),
    "whitespace operators should be rejected",
  );
  assert_true(
    catch_type_error(() => operators({ "?": number_operator(1, "left", add) }))
      .message.includes("reserved syntax"),
    "? operators should be rejected",
  );
  assert_true(
    catch_type_error(() =>
      operators({ "(+)": number_operator(1, "left", add) })
    )
      .message.includes("reserved syntax"),
    "parenthesized operator tokens should be rejected",
  );
  assert_true(
    catch_type_error(() => operators({ '"': number_operator(1, "left", add) }))
      .message.includes("reserved syntax"),
    "quote operator tokens should be rejected",
  );
});

Deno.test("operator constructors enforce operand types at application time", () => {
  const custom_itp = interpreter(operators({
    bool: boolean_unary_operator(8, (value) => value),
    join: string_operator(6, "left", (left, right) => left + right),
    neg: number_unary_operator(8, (value) => -value),
    raw: unary_operator("raw", 8, (value) => ({ value })),
  }));

  assert_equals(custom_itp("bool true"), true);
  assert_equals(custom_itp("'a' join 'b'"), "ab");
  assert_equals(custom_itp("neg 42"), -42);
  assert_equals(custom_itp("raw 42"), { value: 42 });

  assert_type_error_message(
    () => custom_itp("bool 1"),
    "expected a boolean",
    "boolean unary operators should reject non-boolean operands",
  );
  assert_type_error_message(
    () => custom_itp("'a' join 1"),
    "expected a string",
    "string binary operators should reject non-string operands",
  );
  assert_type_error_message(
    () => custom_itp("neg true"),
    "expected a number",
    "number unary operators should reject non-number operands",
  );
});

Deno.test("interpreter supports custom symbolic operators", () => {
  const math_itp = interpreter(operators({
    ...standard_operators,
    "**": number_operator(8, "right", (left, right) => left ** right),
  }));

  assert_equals(math_itp("2 ** 3 ** 2"), 512);
  assert_equals(math_itp("? ** ?", 2, 5), 32);
  assert_equals(itp.get("**"), undefined);
});

Deno.test("interpreter supports unary operators", () => {
  assert_equals(itp("-?0", 42), -42);
  assert_equals(itp("-(?0 + ?1)", 20, 22), -42);
  assert_equals(itp("1 - -2"), 3);
  assert_equals(itp("!false"), true);
  assert_equals(itp("!!true"), true);
  assert_equals(itp("!true == false"), true);
  assert_equals(itp("(-)"), itp.get("-"));
});

Deno.test("interpreter respects unary and binary precedence combinations", () => {
  assert_equals(itp("-2 * 3"), -6);
  assert_equals(itp("-(2 * 3)"), -6);
  assert_equals(itp("-2 * -3"), 6);
  assert_equals(itp("!(1 < 2) == false"), true);
  assert_equals(itp("!(-1 == -1)"), false);
  assert_equals(itp("!!(1 < 2)"), true);
});

Deno.test("interpreter supports custom unary operators and overloads", () => {
  const custom_itp = interpreter(operators({
    add: number_operator(6, "left", (left, right) => left + right),
    neg: number_unary_operator(8, (value) => -value),
    truthy: boolean_unary_operator(8, (value) => value),
    "~": operator(
      number_operator(6, "left", (left, right) => left + right),
      number_unary_operator(8, (value) => -value),
    ),
  }));

  assert_equals(custom_itp("neg ?0 add ?1", 20, 62), 42);
  assert_equals(custom_itp("truthy true"), true);
  assert_equals(custom_itp("~?0 ~ ?1", 20, 62), 42);
  assert_equals(custom_itp("~?0", 42), -42);
});

Deno.test("operator registries reject duplicate arity overloads", () => {
  assert_true(
    catch_type_error(() =>
      operators({
        "-": operator(
          number_operator(6, "left", add),
          number_operator(7, "left", (left, right) => left * right),
        ),
      })
    ).message.includes("more than one arity `2`"),
    "overload sets should have at most one definition per arity",
  );
});

Deno.test("interpreter apply hooks receive unary and binary operands", () => {
  const seen: unknown[][] = [];
  const traced = interpreter(standard_operators, {
    apply_operator(operator, ...operands) {
      seen.push([operator.token, ...operands]);

      switch (operator.definition.arity) {
        case 1:
          return operator.definition.apply(operands[0]);
        case 2:
          return operator.definition.apply(operands[0], operands[1]);
      }
    },
  });

  assert_equals(traced("-?0 + ?1", 20, 62), 42);
  assert_equals(seen, [
    ["-", 20],
    ["+", -20, 62],
  ]);
});

Deno.test("interpreter treats parenthesized operator values as syntax", () => {
  const word_itp = interpreter(operators({
    add: number_operator(6, "left", (left, right) => left + right),
  }));

  assert_equals(itp.get("(+)"), undefined);
  assert_equals(itp("(+)"), itp.get("+"));
  assert_equals(itp("(!=)"), itp.get("!="));
  assert_equals(word_itp.get("(add)"), undefined);
  assert_equals(word_itp("(add)"), word_itp.get("add"));
  assert_equals(itp("((!))"), itp.get("!"));
  assert_equals(itp("((-))"), itp.get("-"));
});

Deno.test("interpreter supports grouped expressions", () => {
  assert_equals(itp("(1 + 2) * 3"), 9);
  assert_equals(itp("1 * (2 + 3)"), 5);
  assert_equals(itp("((1 + 2) * (3 + 4))"), 21);
  assert_equals(itp("(? + ?) * ?", 1, 2, 3), 9);
  assert_equals(itp("((+))"), itp.get("+"));
  assert_equals(itp("('a' ++ ('b' ++ 'c'))"), "abc");
  assert_equals(itp("!(false || (true && false))"), true);
});

Deno.test("interpreter number syntax matches TypeScript number strings", () => {
  assert_equals(itp("1e3 + 2"), 1002);
  assert_equals(itp("1E3 + 2"), 1002);
  assert_equals(itp("1e-3 + 1"), 1.001);
  assert_equals(itp("+.5 + .25"), 0.75);
  assert_equals(itp("1. + 2"), 3);
  assert_equals(itp(".5 + 1"), 1.5);
  assert_equals(itp("0x10 + 1"), 17);
  assert_equals(itp("0b10 + 1"), 3);
  assert_equals(itp("0o10 + 1"), 9);
});

Deno.test("interpreter supports quoted strings and string concatenation", () => {
  assert_equals(itp('"hello"'), "hello");
  assert_equals(itp("'hello'"), "hello");
  assert_equals(itp('"hello" ++ "world"'), "helloworld");
  assert_equals(itp("'hello' ++ ' ' ++ \"world\""), "hello world");
  assert_equals(itp('"line\\n" ++ "tab\\t"'), "line\ntab\t");
  assert_equals(itp("'it\\'s'"), "it's");
  assert_equals(itp('"say \\"hi\\""'), 'say "hi"');
  assert_equals(itp("'slash\\\\'"), "slash\\");
  assert_equals(itp('"carriage\\rreturn"'), "carriage\rreturn");
  assert_equals(itp("'?'"), "?");
  assert_equals(itp("'?name' ++ ?", "value"), "?namevalue");
  assert_equals(itp("'1 + 2' ++ ' = text'"), "1 + 2 = text");
  assert_true(
    catch_type_error(() => itp('"hello" + "world"')).message.includes(
      "expected a number",
    ),
    "+ should remain numeric-only",
  );
});

Deno.test("interpreter accepts JavaScript-interpolated expression strings", () => {
  const n = 20;
  const m = 22;
  const s = "hello";

  assert_equals(itp(`${n} + ${m}`), 42);
  assert_equals(itp(`"${s}" ++ " world"`), "hello world");
  assert_type_error_message(
    () => itp(`"${s}" + "world"`),
    "expected a number",
    "interpolated quoted strings should still use string operators",
  );
});

Deno.test("interpreter reports placeholder arity and preserves undefined values", () => {
  assert_equals(itp("?", undefined), undefined);
  assert_equals(itp("?0", undefined), undefined);
  assert_equals(itp("? == ?", undefined, undefined), true);
  assert_true(
    catch_type_error(() => itp("?")()).message.includes(
      "missing a value for placeholder `1`",
    ),
    "missing placeholder values should be reported precisely",
  );
  assert_true(
    catch_type_error(() => itp("? + ?", 1)).message.includes(
      "missing a value for placeholder `2`",
    ),
    "missing later placeholder values should include the placeholder index",
  );
  assert_true(
    catch_type_error(() => itp("?2", "first", "second")).message.includes(
      "missing a value for placeholder `?2`",
    ),
    "missing indexed values should include the placeholder index",
  );
  assert_true(
    catch_type_error(() => itp("?", 1, 2)).message.includes("too many values"),
    "extra placeholder values should still be rejected",
  );
  assert_true(
    catch_type_error(() => itp("?0 + ?0", 1, 2)).message.includes(
      "too many values",
    ),
    "extra values after the highest indexed placeholder should be rejected",
  );
  assert_type_error_message(
    () => itp("?missing", {}),
    "scope is missing `missing`",
    "missing named scope properties should identify the name",
  );
  assert_type_error_message(
    () => itp("?missing", undefined),
    "expected a scope object",
    "named placeholders should require an object scope",
  );
  assert_type_error_message(
    () => itp("?999999999999999999999", 1),
    "too large",
    "unsafe indexed placeholders should be rejected",
  );
});

Deno.test("interpreter rejects non-associative and mixed-associativity chains", () => {
  const mixed_itp = interpreter(operators({
    same: {
      kind: "equality",
      precedence: 4,
      direction: "none",
      arity: 2,
      apply: Object.is,
    },
    lefty: number_operator(5, "left", (left, right) => left - right),
    righty: number_operator(5, "right", (left, right) => left ** right),
  }));
  const non_associative_error = catch_type_error(() => {
    return mixed_itp("1 same 1 same true");
  });
  const mixed_associativity_error = catch_type_error(() => {
    return mixed_itp("1 lefty 2 righty 3");
  });

  assert_true(
    non_associative_error.message.includes("non-associative"),
    "non-associative operators should not chain at the same precedence",
  );
  assert_true(
    mixed_associativity_error.message.includes("different associativity"),
    "same-precedence mixed associativity should fail",
  );
});

Deno.test("interpreter reports useful syntax and literal errors", () => {
  assert_type_error_message(
    () => evaluate_dynamic(""),
    "did not reduce to one value",
    "empty expressions should be rejected",
  );
  assert_type_error_message(
    () => itp("1 +"),
    "missing a value",
    "trailing binary operators should be rejected",
  );
  assert_type_error_message(
    () => evaluate_dynamic("1 2"),
    "expected a registered operator",
    "adjacent values should be rejected",
  );
  assert_type_error_message(
    () => evaluate_dynamic("(1 + 2"),
    "missing `)`",
    "unclosed groups should be rejected",
  );
  assert_type_error_message(
    () => evaluate_dynamic("()"),
    "expected an expression inside parentheses",
    "empty groups should be rejected",
  );
  assert_type_error_message(
    () => evaluate_dynamic('"unterminated'),
    "missing closing quote",
    "unterminated strings should be rejected",
  );
  assert_type_error_message(
    () => evaluate_dynamic('"bad\\x"'),
    "unsupported escape `x`",
    "unsupported string escapes should be rejected",
  );
  assert_type_error_message(
    () => evaluate_dynamic('"bad\\'),
    "incomplete escape",
    "incomplete string escapes should be rejected",
  );
  assert_type_error_message(
    () => evaluate_dynamic("1_000 + 1"),
    "expected a registered operator",
    "numeric separators are not part of the supported number syntax",
  );
  assert_type_error_message(
    () => evaluate_dynamic("? <%> ?", 1, 2),
    "expected a registered operator",
    "unregistered symbolic operators should be rejected",
  );
  assert_type_error_message(
    () => evaluate_dynamic("? ** ?", 1, 2),
    "expected a registered operator",
    "unknown multi-character symbolic operators should not be split",
  );
});

Deno.test("interpreter apply hooks can replace standard operator semantics", () => {
  const traced = interpreter(standard_operators, {
    apply_operator(operator, ...operands) {
      if (operator.token === "+") {
        return String(operands[0]) + ":" + String(operands[1]);
      }

      if (operator.definition.arity === 1) {
        return operator.definition.apply(operands[0]);
      }

      return operator.definition.apply(operands[0], operands[1]);
    },
  });

  assert_equals(traced("1 + 2"), "1:2");
  assert_equals(traced("-?0", 42), -42);
  assert_equals(assert_raw_runner(traced.raw("1 + 2"))(), "1:2");
});

const expect_interpreter_type_errors = () => {
  // @ts-expect-error Parenthesized values still need registered operators.
  itp("(**)");
  // @ts-expect-error String literals must close with the same quote.
  itp('"unterminated');
  // @ts-expect-error Question marks inside strings must not create runners.
  const question_runner: StringRunner<StandardOperators, "'?'"> = itp("'?'");
  void question_runner;
};

void expect_interpreter_type_errors;

function add(left: number, right: number): number {
  return left + right;
}

function evaluate_dynamic(
  expression: string,
  ...values: readonly unknown[]
): unknown {
  return itp(expression, ...values);
}

function catch_type_error(fn: () => unknown): TypeError {
  let caught: unknown;

  try {
    fn();
  } catch (error) {
    caught = error;
  }

  if (caught instanceof TypeError) {
    return caught;
  }

  throw new Error("Expected TypeError");
}

function assert_type_error_message(
  fn: () => unknown,
  expected: string,
  message: string,
): void {
  assert_true(catch_type_error(fn).message.includes(expected), message);
}

function assert_raw_runner(value: RawStringRunner | Error): RawStringRunner {
  if (value instanceof Error) {
    throw value;
  }

  return value;
}

function assert_raw_error(
  value: RawStringRunner | Error,
  message: string,
): InterpreterError {
  if (value instanceof InterpreterError) {
    return value;
  }

  throw new Error(message);
}
