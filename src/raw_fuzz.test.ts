import { assert_equals, assert_true } from "./assert.ts";
import {
  interpreter,
  InterpreterError,
  type RuntimeOperator,
  terp,
} from "../mod.ts";

Deno.test("raw fuzz compiles arbitrary input to a runner or interpreter error", () => {
  for (const expression of fuzz_expressions()) {
    let result: unknown;

    try {
      result = terp.raw(expression);
    } catch (error) {
      throw new Error(
        "raw threw while compiling " + Deno.inspect(expression) + ": " +
          String(error),
      );
    }

    assert_true(
      typeof result === "function" || result instanceof InterpreterError,
      "raw should return a runner or InterpreterError for " +
        Deno.inspect(expression),
    );

    if (result instanceof InterpreterError) {
      assert_true(
        result instanceof Error,
        "InterpreterError should remain compatible with Error",
      );
      assert_true(
        result.summary.length > 0,
        "raw errors should have a non-empty summary",
      );
      assert_true(
        result.errors.length > 0,
        "raw errors should retain at least one underlying error",
      );
    }
  }
});

Deno.test("raw fuzz treats JavaScript-shaped payloads as expression text", () => {
  const attack_key = "__itp_raw_fuzz_attack__";
  const global_record = globalThis as unknown as Record<string, unknown>;
  delete global_record[attack_key];

  const payloads = [
    "globalThis." + attack_key + " = true",
    "globalThis['" + attack_key + "'] = true",
    'constructor.constructor("globalThis.' + attack_key + ' = true")()',
    'Function("globalThis.' + attack_key + ' = true")()',
    "Deno.exit(1)",
    "while (true) {}",
    "`" + "${globalThis." + attack_key + " = true}" + "`",
    '"; globalThis.' + attack_key + ' = true; "',
    "'; globalThis." + attack_key + " = true; '",
    "?; globalThis." + attack_key + " = true",
    "({}).__proto__.polluted = true",
    "import('file:///tmp/not-real')",
  ];

  for (const payload of payloads) {
    const result = terp.raw(payload);

    assert_true(
      typeof result === "function" || result instanceof InterpreterError,
      "raw should classify JavaScript-shaped payload " + Deno.inspect(payload),
    );
    assert_equals(
      global_record[attack_key],
      undefined,
      "raw should not evaluate JavaScript-shaped payload " +
        Deno.inspect(payload),
    );
  }

  delete global_record[attack_key];
});

Deno.test("raw validation does not execute custom operators or apply hooks", () => {
  const attack_key = "__itp_raw_operator_attack__";
  const global_record = globalThis as unknown as Record<string, unknown>;
  delete global_record[attack_key];
  let operator_calls = 0;
  let hook_calls = 0;

  const hostile = interpreter({
    boom: {
      kind: "hostile",
      precedence: 6,
      direction: "left",
      arity: 2,
      apply(left: unknown, right: unknown) {
        operator_calls += 1;
        global_record[attack_key] = true;
        return [left, right];
      },
    },
    zap: {
      kind: "hostile",
      precedence: 8,
      arity: 1,
      apply(value: unknown) {
        operator_calls += 1;
        global_record[attack_key] = true;
        return value;
      },
    },
  }, {
    apply_operator(operator, ...operands) {
      hook_calls += 1;
      return apply_runtime_operator(operator, operands);
    },
  });

  for (
    const expression of [
      "1 boom 2",
      "? boom ?",
      "zap 1",
      "zap ?0 boom ?1",
      "(1 boom 2) boom (3 boom 4)",
    ]
  ) {
    const result = hostile.raw(expression);

    assert_true(
      typeof result === "function",
      "hostile expression should still compile as syntax: " + expression,
    );
    assert_equals(operator_calls, 0);
    assert_equals(hook_calls, 0);
    assert_equals(global_record[attack_key], undefined);
  }

  const runner = hostile.raw("1 boom 2");

  if (runner instanceof Error) {
    throw runner;
  }

  assert_equals(runner(), [1, 2]);
  assert_equals(operator_calls, 1);
  assert_equals(hook_calls, 1);
  assert_equals(global_record[attack_key], true);
  delete global_record[attack_key];
});

function apply_runtime_operator(
  operator: RuntimeOperator,
  operands: readonly unknown[],
): unknown {
  switch (operator.definition.arity) {
    case 1:
      return operator.definition.apply(operands[0]);
    case 2:
      return operator.definition.apply(operands[0], operands[1]);
  }
}

function fuzz_expressions(): readonly string[] {
  const expressions = new Set<string>([
    "",
    " ",
    "?",
    "?0 + ?0",
    "?left + ?",
    "1 + 2 * 3",
    "1 +",
    "? ** ?",
    "(1 + 2",
    "(()",
    '"unterminated',
    "'unterminated",
    '"bad\\x"',
    "?999999999999999999999",
    "constructor.constructor('return globalThis')()",
    "globalThis.process?.exit?.()",
  ]);
  const random = seeded_random(0x1EADBEEF);
  const alphabet = [
    " ",
    "\t",
    "\n",
    "\r",
    "?",
    "0",
    "1",
    "2",
    "9",
    "a",
    "b",
    "x",
    "y",
    "z",
    "_",
    "$",
    ".",
    "+",
    "-",
    "*",
    "/",
    "%",
    "<",
    ">",
    "=",
    "!",
    "&",
    "|",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    '"',
    "'",
    "\\",
    ";",
    ":",
    ",",
    "`",
  ];

  while (expressions.size < 750) {
    const length = Math.floor(random() * 96);
    let expression = "";

    for (let index = 0; index < length; index += 1) {
      expression += alphabet[Math.floor(random() * alphabet.length)];
    }

    expressions.add(expression);
  }

  return [...expressions];
}

function seeded_random(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
