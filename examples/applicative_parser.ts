import {
  type BinaryOperatorDefinition,
  interpreter,
  type UnaryOperatorDefinition,
} from "../mod.ts";

type ParseResult<value> =
  | {
    readonly ok: true;
    readonly value: value;
    readonly rest: string;
  }
  | {
    readonly ok: false;
    readonly expected: string;
    readonly rest: string;
  };

const parser_tag = Symbol("terp.parser");

type Parser<value> = {
  (input: string): ParseResult<value>;
  readonly label: string;
  readonly [parser_tag]: true;
};

type Mapper = (value: unknown) => unknown;

const primitives = {
  comma: literal(","),
  dash: literal("-"),
  digit: regex_parser("digit", /^[0-9]/),
  letter: regex_parser("letter", /^[A-Za-z]/),
  number(digits: unknown) {
    return Number(as_string_array(digits).join(""));
  },
  word(letters: unknown) {
    return as_string_array(letters).join("");
  },
  coordinate(x: unknown) {
    return (y: unknown) => ({ x, y });
  },
  tag(name: unknown) {
    return (id: unknown) => ({ name, id });
  },
};

const base_parser = parser_interpreter(primitives);
const integer = as_parser(base_parser("number <$> some digit"));
const word = as_parser(base_parser("word <$> some letter"));
const parser = parser_interpreter({ ...primitives, integer, word });

const coordinate = as_parser(
  parser("coordinate <$> integer <* comma <*> integer"),
);
const tag = as_parser(parser("tag <$> word <* dash <*> integer"));
const number_or_word = as_parser(parser("integer <|> word"));

console.log("applicative-parser", {
  integer: preview(integer, "123px"),
  coordinate: preview(coordinate, "12,34!"),
  tag: preview(tag, "alpha-42 "),
  fallback: preview(number_or_word, "hello123"),
});

function parser_interpreter(values: Record<string, unknown>) {
  return interpreter({
    "<$>": map_operator(),
    "<*>": apply_operator(),
    "<*": keep_left_operator(),
    "*>": keep_right_operator(),
    "<|>": alternative_operator(),
    many: many_operator(),
    some: some_operator(),
  }, { values });
}

function map_operator(): BinaryOperatorDefinition<"parser"> {
  return {
    kind: "parser",
    precedence: 5,
    direction: "left",
    arity: 2,
    apply(left, right) {
      if (typeof left !== "function") {
        throw new TypeError("<$> expected a function on the left");
      }

      return map(as_parser(right), left as Mapper);
    },
  };
}

function apply_operator(): BinaryOperatorDefinition<"parser"> {
  return {
    kind: "parser",
    precedence: 5,
    direction: "left",
    arity: 2,
    apply(left, right) {
      return apply_parser(as_parser(left), as_parser(right));
    },
  };
}

function keep_left_operator(): BinaryOperatorDefinition<"parser"> {
  return {
    kind: "parser",
    precedence: 5,
    direction: "left",
    arity: 2,
    apply(left, right) {
      return keep_left(as_parser(left), as_parser(right));
    },
  };
}

function keep_right_operator(): BinaryOperatorDefinition<"parser"> {
  return {
    kind: "parser",
    precedence: 5,
    direction: "left",
    arity: 2,
    apply(left, right) {
      return keep_right(as_parser(left), as_parser(right));
    },
  };
}

function alternative_operator(): BinaryOperatorDefinition<"parser"> {
  return {
    kind: "parser",
    precedence: 2,
    direction: "right",
    arity: 2,
    apply(left, right) {
      return alternative(as_parser(left), as_parser(right));
    },
  };
}

function many_operator(): UnaryOperatorDefinition<"parser"> {
  return {
    kind: "parser",
    precedence: 8,
    arity: 1,
    apply(value) {
      return many(as_parser(value));
    },
  };
}

function some_operator(): UnaryOperatorDefinition<"parser"> {
  return {
    kind: "parser",
    precedence: 8,
    arity: 1,
    apply(value) {
      return some(as_parser(value));
    },
  };
}

function map<left, right>(
  parser: Parser<left>,
  fn: (value: left) => right,
): Parser<right> {
  return make_parser("(" + parser.label + " mapped)", (input) => {
    const result = parser(input);

    if (!result.ok) {
      return result;
    }

    return success(fn(result.value), result.rest);
  });
}

function apply_parser(
  fn_parser: Parser<unknown>,
  value_parser: Parser<unknown>,
): Parser<unknown> {
  return make_parser(
    "(" + fn_parser.label + " <*> " + value_parser.label + ")",
    (input) => {
      const fn_result = fn_parser(input);

      if (!fn_result.ok) {
        return fn_result;
      }

      if (typeof fn_result.value !== "function") {
        return failure("function", fn_result.rest);
      }

      const value_result = value_parser(fn_result.rest);

      if (!value_result.ok) {
        return value_result;
      }

      return success(fn_result.value(value_result.value), value_result.rest);
    },
  );
}

function keep_left<left>(
  left_parser: Parser<left>,
  right_parser: Parser<unknown>,
): Parser<left> {
  return make_parser(
    "(" + left_parser.label + " <* " + right_parser.label + ")",
    (input) => {
      const left_result = left_parser(input);

      if (!left_result.ok) {
        return left_result;
      }

      const right_result = right_parser(left_result.rest);

      if (!right_result.ok) {
        return right_result;
      }

      return success(left_result.value, right_result.rest);
    },
  );
}

function keep_right<right>(
  left_parser: Parser<unknown>,
  right_parser: Parser<right>,
): Parser<right> {
  return make_parser(
    "(" + left_parser.label + " *> " + right_parser.label + ")",
    (input) => {
      const left_result = left_parser(input);

      if (!left_result.ok) {
        return left_result;
      }

      return right_parser(left_result.rest);
    },
  );
}

function alternative<value>(
  left_parser: Parser<value>,
  right_parser: Parser<value>,
): Parser<value> {
  return make_parser(
    "(" + left_parser.label + " <|> " + right_parser.label + ")",
    (input) => {
      const left_result = left_parser(input);

      if (left_result.ok) {
        return left_result;
      }

      const right_result = right_parser(input);

      if (right_result.ok) {
        return right_result;
      }

      return failure(
        left_result.expected + " or " + right_result.expected,
        input,
      );
    },
  );
}

function many<value>(parser: Parser<value>): Parser<readonly value[]> {
  return make_parser("many " + parser.label, (input) => {
    const values: value[] = [];
    let rest = input;

    while (true) {
      const result = parser(rest);

      if (!result.ok) {
        return success(values, rest);
      }

      if (result.rest === rest) {
        throw new TypeError("many parser must consume input");
      }

      values.push(result.value);
      rest = result.rest;
    }
  });
}

function some<value>(parser: Parser<value>): Parser<readonly value[]> {
  return make_parser("some " + parser.label, (input) => {
    const first = parser(input);

    if (!first.ok) {
      return first;
    }

    const rest = many(parser)(first.rest);

    if (!rest.ok) {
      return rest;
    }

    return success([first.value, ...rest.value], rest.rest);
  });
}

function literal(expected: string): Parser<string> {
  return make_parser(JSON.stringify(expected), (input) => {
    return input.startsWith(expected)
      ? success(expected, input.slice(expected.length))
      : failure(JSON.stringify(expected), input);
  });
}

function regex_parser(label: string, regex: RegExp): Parser<string> {
  return make_parser(label, (input) => {
    const match = regex.exec(input);

    return match !== null && match.index === 0
      ? success(match[0], input.slice(match[0].length))
      : failure(label, input);
  });
}

function make_parser<value>(
  label: string,
  parse: (input: string) => ParseResult<value>,
): Parser<value> {
  const parser = ((input: string) => parse(input)) as Parser<value>;

  Object.defineProperty(parser, parser_tag, { value: true });
  Object.defineProperty(parser, "label", { value: label });

  return parser;
}

function success<value>(value: value, rest: string): ParseResult<value> {
  return { ok: true, value, rest };
}

function failure(expected: string, rest: string): ParseResult<never> {
  return { ok: false, expected, rest };
}

function preview(parser: Parser<unknown>, input: string): object {
  const result = parser(input);

  if (!result.ok) {
    return {
      ok: false,
      expected: result.expected,
      rest: result.rest,
    };
  }

  return {
    ok: true,
    value: result.value,
    rest: result.rest,
  };
}

function as_parser(value: unknown): Parser<unknown> {
  if (is_parser(value)) {
    return value;
  }

  throw new TypeError("expected parser value");
}

function is_parser(value: unknown): value is Parser<unknown> {
  return typeof value === "function" &&
    (value as Partial<Parser<unknown>>)[parser_tag] === true;
}

function as_string_array(value: unknown): readonly string[] {
  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  ) {
    return value;
  }

  throw new TypeError("expected string array");
}
