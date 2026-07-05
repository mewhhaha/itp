import { assert_equals, assert_true } from "./assert.ts";
import {
  interpreter,
  itp,
  number_operator,
  operators,
  standard_operators,
} from "../mod.ts";

Deno.test("interpreter evaluates registered infix operators with precedence", () => {
  assert_equals(itp("2 + 3 * 4"), 14);
  assert_equals(itp("10 - 3 - 2"), 5);
  assert_equals(itp("true || false && false"), true);
});

Deno.test("interpreter supports placeholders named references and runners", () => {
  const add = itp("? + ?");
  const named = itp("?left + ?right * ?", {
    left: 2,
    right: 3,
  }, 4);

  assert_equals(add(20, 22), 42);
  assert_equals(named, 14);
  assert_equals(itp("? + ?", 20, 22), 42);
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

Deno.test("interpreter supports custom symbolic operators", () => {
  const math_itp = interpreter(operators({
    ...standard_operators,
    "**": number_operator(8, "right", (left, right) => left ** right),
  }));

  assert_equals(math_itp("2 ** 3 ** 2"), 512);
  assert_equals(math_itp("? ** ?", 2, 5), 32);
  assert_equals(itp.get("**"), undefined);
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

const expect_interpreter_type_errors = () => {
  // @ts-expect-error Strings must use registered operators.
  itp("? <%> ?", 1, 2);
  // @ts-expect-error Strings must not split unknown symbolic operators.
  itp("? ** ?", 1, 2);
  // @ts-expect-error Parenthesized values still need registered operators.
  itp("(**)");
};

void expect_interpreter_type_errors;

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
