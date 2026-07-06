import {
  get_operator_from,
  type OperatorDefinition,
  type OperatorEntry,
  type OperatorRegistry,
  operators as operator_registry,
  standard_operators,
  type StandardOperators,
} from "./operators.ts";

/** Map of names that can be used as bare values inside an interpreter. */
export type ValueRegistry = Readonly<Record<string, unknown>>;

/** Empty named-value registry used by interpreters without `options.values`. */
export type EmptyValueRegistry = Record<never, never>;

type Whitespace = " " | "\n" | "\r" | "\t";

type LowercaseLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type UppercaseLetter = Uppercase<LowercaseLetter>;

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type IdentifierStart = LowercaseLetter | UppercaseLetter | "_" | "$";

type IdentifierPart = IdentifierStart | Digit;

type OperatorSymbol =
  | "!"
  | "#"
  | "$"
  | "%"
  | "&"
  | "*"
  | "+"
  | "-"
  | "."
  | "/"
  | ":"
  | "<"
  | "="
  | ">"
  | "@"
  | "\\"
  | "^"
  | "|"
  | "~";

type IdentifierRest<text extends string> = text extends
  `${infer character}${infer rest}`
  ? character extends IdentifierPart ? IdentifierRest<rest>
  : false
  : true;

type Identifier<text extends string> = text extends
  `${infer character}${infer rest}`
  ? character extends IdentifierStart ? IdentifierRest<rest>
  : false
  : false;

type Digits<text extends string> = text extends "" ? false
  : text extends `${Digit}${infer rest}` ? DigitRest<rest>
  : false;

type DigitRest<text extends string> = text extends "" ? true
  : text extends `${Digit}${infer rest}` ? DigitRest<rest>
  : false;

type TrimLeft<text extends string> = text extends `${Whitespace}${infer rest}`
  ? TrimLeft<rest>
  : text;

type TrimRight<text extends string> = text extends `${infer rest}${Whitespace}`
  ? TrimRight<rest>
  : text;

type Trim<text extends string> = TrimLeft<TrimRight<text>>;

type ContainsOperatorSymbol<text extends string> = text extends
  `${string}${OperatorSymbol}${string}` ? true
  : false;

type StartsWithOperatorSymbol<text extends string> = text extends
  `${OperatorSymbol}${string}` ? true
  : false;

type EndsWithOperatorSymbol<text extends string> = text extends
  `${string}${OperatorSymbol}` ? true
  : false;

type OperatorBoundary<
  operators extends OperatorRegistry,
  operator extends string,
  left extends string,
  right extends string,
> = ContainsOperatorSymbol<operator> extends true
  ? EndsWithOperatorSymbol<left> extends true ? false
  : StartsWithOperatorSymbol<right> extends true
    ? StartsWithUnaryOperator<operators, right> extends true ? true
    : false
  : true
  : true;

type StartsWithUnaryOperator<
  operators extends OperatorRegistry,
  expression extends string,
  operator = OperatorTokenWithArity<operators, 1>,
> = operator extends string
  ? Trim<expression> extends `${operator}${string}` ? true
  : never
  : never;

type StringSyntaxMessage<message extends string> =
  `interpreter string error: ${message}`;

type StringEscape = "\\" | "'" | '"' | "n" | "r" | "t";

type StringLiteralContent<
  text extends string,
  quote extends "'" | '"',
> = text extends "" ? true
  : text extends `\\${infer escaped}${infer rest}`
    ? escaped extends StringEscape ? StringLiteralContent<rest, quote>
    : false
  : text extends `${quote}${string}` ? false
  : text extends `${infer _character}${infer rest}`
    ? StringLiteralContent<rest, quote>
  : false;

type StringLiteral<text extends string> = text extends `"${infer content}"`
  ? StringLiteralContent<content, '"'>
  : text extends `'${infer content}'` ? StringLiteralContent<content, "'">
  : false;

type OperatorToken<operators extends OperatorRegistry> =
  & keyof operators
  & string;

type OperatorEntryHasArity<entry, arity extends 1 | 2> = entry extends
  { readonly arity: arity } ? true
  : entry extends readonly unknown[]
    ? Extract<entry[number], { readonly arity: arity }> extends never ? false
    : true
  : false;

type OperatorTokenWithArity<
  operators extends OperatorRegistry,
  arity extends 1 | 2,
> = {
  [operator in keyof operators & string]: OperatorEntryHasArity<
    operators[operator],
    arity
  > extends true ? operator
    : never;
}[keyof operators & string];

type ParenthesizedOperatorToken<
  operators extends OperatorRegistry,
  operator = OperatorToken<operators>,
> = operator extends string ? `(${operator})`
  : never;

type ValueToken<values extends ValueRegistry> = keyof values & string;

type ReferenceSyntax<reference extends string> = Digits<Trim<reference>> extends
  true ? true
  : Identifier<Trim<reference>>;

type StringOperandSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  operand,
> = ValueStringSyntax<operators, values, operand> extends true ? true
  : operand extends string
    ? [UnaryStringSyntax<operators, values, Trim<operand>>] extends [never]
      ? false
    : true
  : false;

type UnaryStringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  operator = OperatorTokenWithArity<operators, 1>,
> = operator extends string
  ? Trim<expression> extends `${operator}${infer operand}`
    ? StringOperandSyntax<operators, values, operand> extends true ? true
    : never
  : never
  : never;

type ValueStringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  operand,
> = operand extends string ? Trim<operand> extends "" ? false
  : Trim<operand> extends "?" ? true
  : Trim<operand> extends `?${infer reference}` ? ReferenceSyntax<reference>
  : Trim<operand> extends `${number}` ? true
  : Trim<operand> extends "true" | "false" ? true
  : StringLiteral<Trim<operand>> extends true ? true
  : Trim<operand> extends ValueToken<values> ? true
  : Trim<operand> extends ParenthesizedOperatorToken<operators> ? true
  : Trim<operand> extends `(${infer expression})`
    ? [StringSyntax<operators, values, expression>] extends [never] ? false
    : true
  : false
  : false;

type BinaryStringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  operator = OperatorTokenWithArity<operators, 2>,
> = operator extends string
  ? BinaryStringSyntaxForOperator<operators, values, Trim<expression>, operator>
  : never;

type BinaryStringSyntaxForOperator<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  operator extends string,
  prefix extends string = "",
> = expression extends `${infer left}${operator}${infer right}`
  ? OperatorBoundary<
    operators,
    operator,
    `${prefix}${left}`,
    right
  > extends true ? BinaryStringTailSyntax<
      operators,
      values,
      `${prefix}${left}`,
      right
    > extends infer syntax
      ? [syntax] extends [never] ? BinaryStringSyntaxForOperator<
          operators,
          values,
          right,
          operator,
          `${prefix}${left}${operator}`
        >
      : syntax
    : never
  : BinaryStringSyntaxForOperator<
    operators,
    values,
    right,
    operator,
    `${prefix}${left}${operator}`
  >
  : never;

type BinaryStringHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  operator = OperatorTokenWithArity<operators, 2>,
> = operator extends string ? BinaryStringHasReferenceForOperator<
    operators,
    values,
    Trim<expression>,
    operator
  >
  : never;

type BinaryStringHasReferenceForOperator<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  operator extends string,
  prefix extends string = "",
> = expression extends `${infer left}${operator}${infer right}`
  ? OperatorBoundary<
    operators,
    operator,
    `${prefix}${left}`,
    right
  > extends true ? BinaryStringTailSyntax<
      operators,
      values,
      `${prefix}${left}`,
      right
    > extends infer syntax
      ? [syntax] extends [never] ? BinaryStringHasReferenceForOperator<
          operators,
          values,
          right,
          operator,
          `${prefix}${left}${operator}`
        >
      : Or<
        StringOperandHasReference<operators, values, `${prefix}${left}`>,
        ValueExpressionHasReference<operators, values, right>
      >
    : never
  : BinaryStringHasReferenceForOperator<
    operators,
    values,
    right,
    operator,
    `${prefix}${left}${operator}`
  >
  : never;

type BinaryStringTailSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  left extends string,
  right extends string,
> = StringOperandSyntax<operators, values, left> extends true
  ? ValueExpressionTailSyntax<operators, values, right> extends true ? true
  : never
  : never;

type ValueExpressionTailSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
> = StringOperandSyntax<operators, values, expression> extends true ? true
  : BinaryStringSyntax<operators, values, expression> extends infer syntax
    ? [syntax] extends [never] ? never
    : true
  : never;

type StringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
> = StringOperandSyntax<operators, values, expression> extends true ? true
  : BinaryStringSyntax<operators, values, expression> extends never ? never
  : true;

type StringSyntaxMessageFor<expression extends string> = StringSyntaxMessage<
  `\`${expression}\` expected operands separated by registered operators`
>;

type Or<left, right> = left extends true ? true
  : right extends true ? true
  : false;

type StringOperandHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  operand,
> = ValueStringSyntax<operators, values, operand> extends true
  ? ValueStringHasReference<operators, values, operand>
  : operand extends string
    ? [UnaryStringHasReference<operators, values, Trim<operand>>] extends
      [never] ? false
    : UnaryStringHasReference<operators, values, Trim<operand>>
  : false;

type UnaryStringHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  operator = OperatorTokenWithArity<operators, 1>,
> = operator extends string
  ? Trim<expression> extends `${operator}${infer operand}`
    ? StringOperandHasReference<operators, values, operand>
  : never
  : never;

type ValueStringHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  operand,
> = operand extends string ? Trim<operand> extends "?" ? true
  : Trim<operand> extends `?${infer reference}` ? ReferenceSyntax<reference>
  : Trim<operand> extends `${number}` ? false
  : Trim<operand> extends "true" | "false" ? false
  : StringLiteral<Trim<operand>> extends true ? false
  : Trim<operand> extends ValueToken<values> ? false
  : Trim<operand> extends ParenthesizedOperatorToken<operators> ? false
  : Trim<operand> extends `(${infer expression})`
    ? StringExpressionHasReference<operators, values, expression>
  : false
  : false;

type ValueExpressionHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
> = StringOperandSyntax<operators, values, expression> extends true
  ? StringOperandHasReference<operators, values, expression>
  : BinaryStringHasReference<operators, values, expression> extends
    infer has_reference ? [has_reference] extends [never] ? false
    : has_reference extends true ? true
    : false
  : false;

type StringExpressionHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
> = ValueExpressionHasReference<operators, values, expression>;

/** @internal */
type StringCallResult<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  rest extends readonly unknown[],
> = string extends expression ? unknown
  : StringSyntax<operators, values, expression> extends never
    ? StringSyntaxMessageFor<expression>
  : rest extends readonly []
    ? StringExpressionHasReference<operators, values, expression> extends true
      ? StringRunner<operators, expression>
    : unknown
  : unknown;

/** @internal */
type CheckedArgument<argument, result> = result extends
  StringSyntaxMessage<string> ? result
  : argument;

/** @internal */
type CheckedResult<result> = result extends StringSyntaxMessage<string> ? never
  : result;

/** Deferred expression runner returned when placeholders are present. */
export type StringRunner<
  _operators extends OperatorRegistry,
  _expression extends string,
> = (...values: readonly unknown[]) => unknown;

/** Runtime-only expression runner returned by {@link Interpreter.raw}. */
export type RawStringRunner = (...values: unknown[]) => unknown;

/** Result of compiling a runtime-only expression with {@link Interpreter.raw}. */
export type RawStringResult = RawStringRunner | InterpreterError;

/** Error returned when a runtime-only expression cannot be compiled. */
export class InterpreterError extends Error {
  /** Short user-facing description of what went wrong. */
  readonly summary: string;
  /** One or more underlying errors that contributed to this failure. */
  readonly errors: readonly Error[];
  /** Original error that produced this interpreter error. */
  override readonly cause: unknown;

  /** Create an interpreter error with a short summary and optional cause. */
  constructor(
    summary: string,
    options: {
      readonly cause?: unknown;
      readonly errors?: readonly Error[];
    } = {},
  ) {
    super(summary);
    this.name = "InterpreterError";
    this.summary = summary;
    this.errors = options.errors ?? errors_from_cause(options.cause);
    this.cause = options.cause;
  }
}

/** Custom hook for applying an operator during expression evaluation. */
export type InterpreterApplyOperator = (
  operator: RuntimeOperator,
  ...operands: readonly unknown[]
) => unknown;

/** Runtime options for a string interpreter. */
export interface InterpreterOptions<
  values extends ValueRegistry = EmptyValueRegistry,
> {
  /** Override operator application while preserving parsing and precedence. */
  readonly apply_operator?: InterpreterApplyOperator;
  /** Named values that can be referenced directly from expressions. */
  readonly values?: values;
}

/** Callable interpreter with its operator registry attached. */
export type Interpreter<
  operators extends OperatorRegistry,
  values extends ValueRegistry = EmptyValueRegistry,
> = {
  readonly operators: operators;
  readonly values: values;
  get<const token extends keyof operators & string>(
    token: token,
  ): operators[token];
  get(token: string): OperatorEntry | undefined;
  get_value<const name extends keyof values & string>(name: name): values[name];
  get_value(name: string): unknown | undefined;
  /** Create a reusable runner from a dynamic expression string. */
  raw(expression: string): RawStringResult;
  <
    const expression extends string,
    const rest extends readonly unknown[],
  >(
    expression: CheckedArgument<
      expression,
      StringCallResult<operators, values, expression, rest>
    >,
    ...rest: rest
  ): CheckedResult<StringCallResult<operators, values, expression, rest>>;
};

/** Create a callable interpreter from an operator registry. */
export function interpreter<
  const operators extends OperatorRegistry,
  const values extends ValueRegistry = EmptyValueRegistry,
>(
  operators: operators,
  options: InterpreterOptions<values> = {},
): Interpreter<operators, values> {
  operator_registry(operators);
  const named_values = options.values ?? ({} as values);
  validate_value_registry(operators, named_values);

  const interpreter = ((expression: string, ...substitutions: unknown[]) => {
    return interpret_string_expression(
      operators,
      named_values,
      expression,
      substitutions,
      options,
    );
  }) as unknown as Interpreter<operators, values>;

  Object.defineProperty(interpreter, "operators", {
    value: operators,
    enumerable: false,
  });
  Object.defineProperty(interpreter, "values", {
    value: named_values,
    enumerable: false,
  });
  Object.defineProperty(interpreter, "get", {
    value(token: string) {
      return get_operator_from(operators, token);
    },
    enumerable: false,
  });
  Object.defineProperty(interpreter, "get_value", {
    value(name: string) {
      return Object.hasOwn(named_values, name) ? named_values[name] : undefined;
    },
    enumerable: false,
  });
  Object.defineProperty(interpreter, "raw", {
    value(expression: string): RawStringResult {
      const error = validate_raw_string_expression(
        operators,
        named_values,
        expression,
      );

      if (error !== undefined) {
        return error;
      }

      return (...substitutions: unknown[]) => {
        return evaluate_string_expression(
          operators,
          named_values,
          expression,
          substitutions,
          options,
        );
      };
    },
    enumerable: false,
  });

  return interpreter;
}

/** Default interpreter using {@link standard_operators}. */
export const terp: Interpreter<StandardOperators> = interpreter(
  standard_operators,
);

type RuntimeToken =
  | {
    readonly kind: "value";
    readonly value: unknown;
  }
  | ({
    readonly kind: "operator";
  } & RuntimeOperator);

/** Runtime operator token and definition pair passed to custom hooks. */
export type RuntimeOperator = {
  readonly token: string;
  readonly definition: OperatorDefinition;
};

type TokenizeContext = {
  readonly named_values: ValueRegistry;
  readonly scope: unknown;
  readonly values: readonly unknown[];
  readonly resolve_references: boolean;
  value_index: number;
};

const raw_validation_value = Symbol("terp.raw.validation.value");

function validate_value_registry(
  operators: OperatorRegistry,
  values: ValueRegistry,
): void {
  for (const name of Object.keys(values)) {
    validate_value_name(name);

    if (get_operator_from(operators, name) !== undefined) {
      throw new TypeError(
        "interpreter value name `" + name +
          "` must not conflict with an operator token",
      );
    }
  }
}

function validate_value_name(name: string): void {
  const identifier = read_identifier(name, 0);

  if (identifier === undefined || identifier.next !== name.length) {
    throw new TypeError(
      "interpreter value name `" + name + "` must be a valid identifier",
    );
  }

  if (name === "true" || name === "false") {
    throw new TypeError(
      "interpreter value name `" + name + "` is reserved for boolean literals",
    );
  }
}

function interpret_string_expression(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
  substitutions: readonly unknown[],
  options: InterpreterOptions,
): unknown {
  if (
    substitutions.length === 0 &&
    has_reference(operators, named_values, expression)
  ) {
    return (...values: readonly unknown[]) => {
      return evaluate_string_expression(
        operators,
        named_values,
        expression,
        values,
        options,
      );
    };
  }

  return evaluate_string_expression(
    operators,
    named_values,
    expression,
    substitutions,
    options,
  );
}

function evaluate_string_expression(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
  substitutions: readonly unknown[],
  options: InterpreterOptions,
): unknown {
  const has_named_references = has_named_reference(
    operators,
    named_values,
    expression,
  );
  const scope = has_named_references ? substitutions[0] : undefined;
  const values = has_named_references ? substitutions.slice(1) : substitutions;
  const context: TokenizeContext = {
    named_values,
    scope,
    values,
    resolve_references: true,
    value_index: 0,
  };

  const result = evaluate_text(operators, expression, context, options);

  if (context.value_index < values.length) {
    throw new TypeError("interpreter expression received too many values");
  }

  return result;
}

function validate_raw_string_expression(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
): InterpreterError | undefined {
  const context: TokenizeContext = {
    named_values,
    scope: undefined,
    values: [],
    resolve_references: false,
    value_index: 0,
  };

  try {
    evaluate_text(operators, expression, context, {
      apply_operator() {
        return raw_validation_value;
      },
    });
  } catch (error) {
    return interpreter_error_from(error);
  }

  return undefined;
}

function interpreter_error_from(error: unknown): InterpreterError {
  if (error instanceof InterpreterError) {
    return error;
  }

  if (error instanceof Error) {
    return new InterpreterError(summarize_error_message(error.message), {
      cause: error,
      errors: [error],
    });
  }

  return new InterpreterError(String(error), {
    cause: error,
    errors: [new Error(String(error))],
  });
}

function summarize_error_message(message: string): string {
  return message.replace(/^interpreter\s+/, "");
}

function errors_from_cause(cause: unknown): readonly Error[] {
  if (cause instanceof Error) {
    return [cause];
  }

  return [];
}

function evaluate_text(
  operators: OperatorRegistry,
  text: string,
  context: TokenizeContext,
  options: InterpreterOptions,
): unknown {
  const tokens = tokenize_text(operators, text, context, options, true);

  return evaluate_tokens(tokens.tokens, options);
}

function tokenize_text(
  operators: OperatorRegistry,
  text: string,
  context: TokenizeContext,
  options: InterpreterOptions,
  expecting_value: boolean,
  tokens: RuntimeToken[] = [],
): { readonly tokens: RuntimeToken[]; readonly expecting_value: boolean } {
  let index = 0;

  while (index < text.length) {
    const next = skip_whitespace(text, index);
    index = next;

    if (index >= text.length) {
      break;
    }

    if (expecting_value) {
      const operator = read_operator(operators, text, index, 1, false);

      if (operator !== undefined) {
        tokens.push({
          kind: "operator",
          token: operator.token,
          definition: operator.definition,
        });
        index = operator.next;
        continue;
      }

      const value = read_value(operators, text, index, context, options);

      if (value === undefined) {
        throw new TypeError(
          "interpreter expected a value at `" + text.slice(index).trim() + "`",
        );
      }

      tokens.push({ kind: "value", value: value.value });
      index = value.next;
      expecting_value = false;
      continue;
    }

    const operator = read_operator(operators, text, index, 2, true);

    if (operator === undefined) {
      throw new TypeError(
        "interpreter expected a registered operator at `" +
          text.slice(index).trim() + "`",
      );
    }

    tokens.push({
      kind: "operator",
      token: operator.token,
      definition: operator.definition,
    });
    index = operator.next;
    expecting_value = true;
  }

  return { tokens, expecting_value };
}

function read_value(
  operators: OperatorRegistry,
  text: string,
  index: number,
  context: TokenizeContext,
  options: InterpreterOptions,
): { readonly value: unknown; readonly next: number } | undefined {
  if (text[index] === "?") {
    return read_reference(text, index, context);
  }

  const literal = read_literal(text, index);

  if (literal !== undefined) {
    return literal;
  }

  const named_value = read_named_value(context.named_values, text, index);

  if (named_value !== undefined) {
    return named_value;
  }

  const name = read_identifier(text, index);

  if (name !== undefined) {
    throw new TypeError(
      "interpreter value `" + name.name + "` is not defined",
    );
  }

  return read_parenthesized_operator_value(operators, text, index) ??
    read_parenthesized_expression(operators, text, index, context, options);
}

function read_named_value(
  values: ValueRegistry,
  text: string,
  index: number,
): { readonly value: unknown; readonly next: number } | undefined {
  const name = read_identifier(text, index);

  if (name === undefined || !Object.hasOwn(values, name.name)) {
    return undefined;
  }

  return { value: values[name.name], next: name.next };
}

function read_parenthesized_operator_value(
  operators: OperatorRegistry,
  text: string,
  index: number,
): { readonly value: unknown; readonly next: number } | undefined {
  if (text[index] !== "(") {
    return undefined;
  }

  const operator = read_operator_entry(operators, text, index + 1);

  if (operator === undefined || text[operator.next] !== ")") {
    return undefined;
  }

  return { value: operator.entry, next: operator.next + 1 };
}

function read_parenthesized_expression(
  operators: OperatorRegistry,
  text: string,
  index: number,
  context: TokenizeContext,
  options: InterpreterOptions,
): { readonly value: unknown; readonly next: number } | undefined {
  if (text[index] !== "(") {
    return undefined;
  }

  const close = find_closing_parenthesis(text, index);

  if (close === undefined) {
    throw new TypeError("interpreter expression is missing `)`");
  }

  const expression = text.slice(index + 1, close);

  if (expression.trim() === "") {
    throw new TypeError(
      "interpreter expected an expression inside parentheses",
    );
  }

  return {
    value: evaluate_text(operators, expression, context, options),
    next: close + 1,
  };
}

function read_reference(
  text: string,
  index: number,
  context: TokenizeContext,
): { readonly value: unknown; readonly next: number } {
  const reference = index + 1;
  const indexed = read_indexed_reference(text, reference);

  if (indexed !== undefined) {
    if (!context.resolve_references) {
      context.value_index = Math.max(context.value_index, indexed.index + 1);

      return {
        value: raw_validation_value,
        next: indexed.next,
      };
    }

    if (indexed.index >= context.values.length) {
      throw new TypeError(
        "interpreter expression is missing a value for placeholder `?" +
          indexed.raw + "`",
      );
    }

    context.value_index = Math.max(context.value_index, indexed.index + 1);

    return { value: context.values[indexed.index], next: indexed.next };
  }

  const name = read_identifier(text, reference);

  if (name === undefined) {
    if (!context.resolve_references) {
      context.value_index += 1;

      return { value: raw_validation_value, next: index + 1 };
    }

    if (context.value_index >= context.values.length) {
      throw new TypeError(
        "interpreter expression is missing a value for placeholder `" +
          (context.value_index + 1) + "`",
      );
    }

    const value = context.values[context.value_index];
    context.value_index += 1;

    return { value, next: index + 1 };
  }

  if (!context.resolve_references) {
    return {
      value: raw_validation_value,
      next: name.next,
    };
  }

  return {
    value: named_scope_value(context.scope, name.name),
    next: name.next,
  };
}

function read_literal(
  text: string,
  index: number,
): { readonly value: unknown; readonly next: number } | undefined {
  const string = read_string_literal(text, index);

  if (string !== undefined) {
    return string;
  }

  const number =
    /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|[+-]?(?:(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?))/
      .exec(
        text.slice(index),
      );

  if (number !== null) {
    return { value: Number(number[0]), next: index + number[0].length };
  }

  if (
    text.startsWith("true", index) &&
    !is_identifier_part(text[index + "true".length])
  ) {
    return { value: true, next: index + "true".length };
  }

  if (
    text.startsWith("false", index) &&
    !is_identifier_part(text[index + "false".length])
  ) {
    return { value: false, next: index + "false".length };
  }

  return undefined;
}

function read_string_literal(
  text: string,
  index: number,
): { readonly value: string; readonly next: number } | undefined {
  const quote = text[index];

  if (quote !== '"' && quote !== "'") {
    return undefined;
  }

  let next = index + 1;
  let value = "";

  while (next < text.length) {
    const character = text[next];

    if (character === quote) {
      return { value, next: next + 1 };
    }

    if (character !== "\\") {
      value += character;
      next += 1;
      continue;
    }

    const escape = text[next + 1];

    if (escape === undefined) {
      throw new TypeError(
        "interpreter string literal has an incomplete escape",
      );
    }

    value += escaped_character(escape);
    next += 2;
  }

  throw new TypeError("interpreter string literal is missing closing quote");
}

function escaped_character(escape: string): string {
  switch (escape) {
    case "\\":
    case '"':
    case "'":
      return escape;
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    default:
      throw new TypeError(
        "interpreter string literal has unsupported escape `" + escape + "`",
      );
  }
}

function read_indexed_reference(
  text: string,
  index: number,
):
  | { readonly index: number; readonly raw: string; readonly next: number }
  | undefined {
  const match = /^\d+/.exec(text.slice(index));

  if (match === null) {
    return undefined;
  }

  const raw = match[0];
  const value = Number(raw);

  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      "interpreter placeholder index `" + raw + "` is too large",
    );
  }

  return { index: value, raw, next: index + raw.length };
}

function read_identifier(
  text: string,
  index: number,
): { readonly name: string; readonly next: number } | undefined {
  const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(index));

  if (match === null) {
    return undefined;
  }

  return { name: match[0], next: index + match[0].length };
}

function is_identifier_part(character: string | undefined): boolean {
  return character !== undefined && /^[A-Za-z0-9_$]$/.test(character);
}

function read_operator(
  operators: OperatorRegistry,
  text: string,
  index: number,
  arity: 1 | 2,
  check_boundary: boolean,
):
  | {
    readonly token: string;
    readonly definition: OperatorDefinition;
    readonly next: number;
  }
  | undefined {
  for (const token of operator_tokens(operators)) {
    if (
      text.startsWith(token, index) &&
      (
        !check_boundary ||
        has_operator_boundary(operators, text, index, token, arity)
      )
    ) {
      const definition = operator_definition_for_arity(operators[token], arity);

      if (definition === undefined) {
        continue;
      }

      return {
        token,
        definition,
        next: index + token.length,
      };
    }
  }

  return undefined;
}

function read_operator_entry(
  operators: OperatorRegistry,
  text: string,
  index: number,
):
  | {
    readonly token: string;
    readonly entry: OperatorEntry;
    readonly next: number;
  }
  | undefined {
  for (const token of operator_tokens(operators)) {
    if (
      text.startsWith(token, index) &&
      has_operator_entry_boundary(text, index, token)
    ) {
      return {
        token,
        entry: operators[token],
        next: index + token.length,
      };
    }
  }

  return undefined;
}

function operator_definition_for_arity(
  entry: OperatorEntry,
  arity: 1 | 2,
): OperatorDefinition | undefined {
  if (!is_operator_overloads(entry)) {
    return entry.arity === arity ? entry : undefined;
  }

  return entry.find((definition) => definition.arity === arity);
}

function is_operator_overloads(entry: OperatorEntry): entry is readonly [
  OperatorDefinition,
  ...OperatorDefinition[],
] {
  return Array.isArray(entry);
}

function operator_tokens(operators: OperatorRegistry): readonly string[] {
  return Object.keys(operators).sort((left, right) => {
    return right.length - left.length;
  });
}

function has_operator_boundary(
  operators: OperatorRegistry,
  text: string,
  index: number,
  operator: string,
  arity: 1 | 2,
): boolean {
  if (!has_operator_symbol(operator)) {
    return true;
  }

  const before = text[index - 1];
  const after = text[index + operator.length];

  if (before !== undefined && is_operator_symbol(before)) {
    return false;
  }

  if (
    after !== undefined &&
    is_operator_symbol(after) &&
    !has_unary_operator_at(operators, text, index + operator.length, arity)
  ) {
    return false;
  }

  return true;
}

function has_operator_entry_boundary(
  text: string,
  index: number,
  operator: string,
): boolean {
  if (!has_operator_symbol(operator)) {
    return true;
  }

  const before = text[index - 1];
  const after = text[index + operator.length];

  if (before !== undefined && is_operator_symbol(before)) {
    return false;
  }

  if (after !== undefined && is_operator_symbol(after)) {
    return false;
  }

  return true;
}

function has_unary_operator_at(
  operators: OperatorRegistry,
  text: string,
  index: number,
  arity: 1 | 2,
): boolean {
  if (arity !== 2) {
    return false;
  }

  return read_operator(operators, text, index, 1, false) !== undefined;
}

function has_operator_symbol(text: string): boolean {
  for (const character of text) {
    if (is_operator_symbol(character)) {
      return true;
    }
  }

  return false;
}

function is_operator_symbol(character: string): boolean {
  switch (character) {
    case "!":
    case "#":
    case "$":
    case "%":
    case "&":
    case "*":
    case "+":
    case "-":
    case ".":
    case "/":
    case ":":
    case "<":
    case "=":
    case ">":
    case "@":
    case "\\":
    case "^":
    case "|":
    case "~":
      return true;
    default:
      return false;
  }
}

function evaluate_tokens(
  tokens: readonly RuntimeToken[],
  options: InterpreterOptions,
): unknown {
  const values: unknown[] = [];
  const operators_stack: RuntimeOperator[] = [];

  for (const token of tokens) {
    switch (token.kind) {
      case "value":
        values.push(token.value);
        break;
      case "operator":
        while (
          operators_stack.length > 0 &&
          should_apply_operator(
            operators_stack[operators_stack.length - 1],
            token,
          )
        ) {
          apply_operator_token(values, operators_stack.pop(), options);
        }

        operators_stack.push(token);
        break;
    }
  }

  while (operators_stack.length > 0) {
    apply_operator_token(values, operators_stack.pop(), options);
  }

  if (values.length !== 1) {
    throw new TypeError("interpreter expression did not reduce to one value");
  }

  return values[0];
}

function should_apply_operator(
  previous: RuntimeOperator,
  next: RuntimeOperator,
): boolean {
  if (next.definition.arity === 1) {
    return false;
  }

  if (previous.definition.precedence > next.definition.precedence) {
    return true;
  }

  if (previous.definition.precedence < next.definition.precedence) {
    return false;
  }

  if (previous.definition.arity === 1) {
    return true;
  }

  if (previous.definition.direction !== next.definition.direction) {
    throw new TypeError(
      "operators `" + previous.token + "` and `" + next.token +
        "` share precedence but have different associativity",
    );
  }

  switch (next.definition.direction) {
    case "left":
      return true;
    case "right":
      return false;
    case "none":
      throw new TypeError(
        "operator `" + next.token +
          "` is non-associative and cannot be chained at the same precedence",
      );
  }
}

function apply_operator_token(
  values: unknown[],
  operator: RuntimeOperator | undefined,
  options: InterpreterOptions,
): void {
  if (operator === undefined) {
    throw new TypeError("interpreter expression is missing an operator");
  }

  switch (operator.definition.arity) {
    case 1: {
      if (values.length < 1) {
        throw new TypeError("interpreter expression is missing a value");
      }

      const value = values.pop();

      values.push(apply_operator_value(operator, [value], options));
      break;
    }
    case 2: {
      if (values.length < 2) {
        throw new TypeError("interpreter expression is missing a value");
      }

      const right = values.pop();
      const left = values.pop();

      values.push(apply_operator_value(operator, [left, right], options));
      break;
    }
  }
}

function apply_operator_value(
  operator: RuntimeOperator,
  operands: readonly unknown[],
  options: InterpreterOptions,
): unknown {
  try {
    if (options.apply_operator !== undefined) {
      return options.apply_operator(operator, ...operands);
    }

    switch (operator.definition.arity) {
      case 1:
        return operator.definition.apply(operands[0]);
      case 2:
        return operator.definition.apply(operands[0], operands[1]);
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new TypeError(
        "operator `" + operator.token + "` failed: " + error.message,
      );
    }

    throw error;
  }
}

function skip_whitespace(text: string, index: number): number {
  let next = index;

  while (next < text.length && /\s/.test(text[next])) {
    next += 1;
  }

  return next;
}

function has_reference(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
): boolean {
  let index = 0;
  let expecting_value = true;

  while (index < expression.length) {
    index = skip_whitespace(expression, index);

    if (index >= expression.length) {
      return false;
    }

    if (expecting_value) {
      const prefix = read_operator(operators, expression, index, 1, false);

      if (prefix !== undefined) {
        index = prefix.next;
        continue;
      }

      if (expression[index] === "?") {
        return true;
      }

      const literal = read_literal(expression, index);

      if (literal !== undefined) {
        index = literal.next;
        expecting_value = false;
        continue;
      }

      const named_value = read_named_value(named_values, expression, index);

      if (named_value !== undefined) {
        index = named_value.next;
        expecting_value = false;
        continue;
      }

      const operator_value = read_parenthesized_operator_value(
        operators,
        expression,
        index,
      );

      if (operator_value !== undefined) {
        index = operator_value.next;
        expecting_value = false;
        continue;
      }

      if (expression[index] === "(") {
        const close = find_closing_parenthesis(expression, index);

        if (close === undefined) {
          return false;
        }

        if (
          has_reference(
            operators,
            named_values,
            expression.slice(index + 1, close),
          )
        ) {
          return true;
        }

        index = close + 1;
        expecting_value = false;
        continue;
      }

      return false;
    }

    const operator = read_operator(operators, expression, index, 2, true);

    if (operator === undefined) {
      return false;
    }

    index = operator.next;
    expecting_value = true;
  }

  return false;
}

function has_named_reference(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
): boolean {
  let index = 0;
  let expecting_value = true;

  while (index < expression.length) {
    index = skip_whitespace(expression, index);

    if (index >= expression.length) {
      return false;
    }

    if (expecting_value) {
      const prefix = read_operator(operators, expression, index, 1, false);

      if (prefix !== undefined) {
        index = prefix.next;
        continue;
      }

      if (expression[index] === "?") {
        if (read_identifier(expression, index + 1) !== undefined) {
          return true;
        }

        const indexed = read_indexed_reference(expression, index + 1);
        index = indexed?.next ?? index + 1;
        expecting_value = false;
        continue;
      }

      const literal = read_literal(expression, index);

      if (literal !== undefined) {
        index = literal.next;
        expecting_value = false;
        continue;
      }

      const named_value = read_named_value(named_values, expression, index);

      if (named_value !== undefined) {
        index = named_value.next;
        expecting_value = false;
        continue;
      }

      const operator_value = read_parenthesized_operator_value(
        operators,
        expression,
        index,
      );

      if (operator_value !== undefined) {
        index = operator_value.next;
        expecting_value = false;
        continue;
      }

      if (expression[index] === "(") {
        const close = find_closing_parenthesis(expression, index);

        if (close === undefined) {
          return false;
        }

        if (
          has_named_reference(
            operators,
            named_values,
            expression.slice(index + 1, close),
          )
        ) {
          return true;
        }

        index = close + 1;
        expecting_value = false;
        continue;
      }

      return false;
    }

    const operator = read_operator(operators, expression, index, 2, true);

    if (operator === undefined) {
      return false;
    }

    index = operator.next;
    expecting_value = true;
  }

  return false;
}

function find_closing_parenthesis(
  text: string,
  open: number,
): number | undefined {
  let depth = 0;

  for (let index = open; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"' || character === "'") {
      index = skip_string_literal(text, index) - 1;
      continue;
    }

    switch (character) {
      case "(":
        depth += 1;
        break;
      case ")":
        depth -= 1;

        if (depth === 0) {
          return index;
        }

        break;
    }
  }

  return undefined;
}

function skip_string_literal(text: string, index: number): number {
  const quote = text[index];
  let next = index + 1;

  while (next < text.length) {
    if (text[next] === quote) {
      return next + 1;
    }

    if (text[next] === "\\") {
      if (text[next + 1] === undefined) {
        throw new TypeError(
          "interpreter string literal has an incomplete escape",
        );
      }

      next += 2;
      continue;
    }

    next += 1;
  }

  throw new TypeError("interpreter string literal is missing closing quote");
}

function named_scope_value(scope: unknown, name: string): unknown {
  if (typeof scope !== "object" || scope === null) {
    throw new TypeError("interpreter expression expected a scope object");
  }

  if (!Object.hasOwn(scope, name)) {
    throw new TypeError(
      "interpreter expression scope is missing `" + name + "`",
    );
  }

  return (scope as Record<string, unknown>)[name];
}
