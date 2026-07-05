/** Associativity for operators at the same precedence. */
export type InfixDirection = "left" | "right" | "none";

/** Runtime definition for an infix operator. */
export interface OperatorDefinition<kind extends string = string> {
  /** Category used for narrowing and lookup helpers. */
  readonly kind: kind;
  /** Higher values bind more tightly. */
  readonly precedence: number;
  /** Associativity when adjacent operators share precedence. */
  readonly direction: InfixDirection;
  /** The interpreter currently supports binary operators. */
  readonly arity: 2;
  /** Apply the operator to already-evaluated operands. */
  readonly apply: (left: unknown, right: unknown) => unknown;
}

/** Map of operator tokens to runtime definitions. */
export type OperatorRegistry<kind extends string = string> = Readonly<
  Record<string, OperatorDefinition<kind>>
>;

/** Operator tokens in a registry whose definition has the requested kind. */
export type OperatorsByKind<
  operators extends OperatorRegistry,
  kind extends string,
> = {
  [operator in keyof operators & string]: operators[operator]["kind"] extends
    kind ? operator
    : never;
}[keyof operators & string];

/** Create an operator registry while preserving literal token types. */
export function operators<const registry extends OperatorRegistry>(
  registry: registry,
): registry {
  validate_operator_registry(registry);

  return registry;
}

/** Create one operator while preserving its literal kind. */
export function operator<const definition extends OperatorDefinition>(
  definition: definition,
): definition {
  return definition;
}

function validate_operator_registry(registry: OperatorRegistry): void {
  for (const token of Object.keys(registry)) {
    validate_operator_token(token);
  }
}

function validate_operator_token(token: string): void {
  if (token.length === 0) {
    throw new TypeError("operator token must not be empty");
  }

  if (/\s/.test(token)) {
    throw new TypeError(
      "operator token `" + token + "` must not contain whitespace",
    );
  }

  if (/[()?'"]/.test(token)) {
    throw new TypeError(
      "operator token `" + token +
        "` must not contain reserved syntax characters",
    );
  }
}

/** Look up an operator definition by token. */
export function get_operator_from(
  operators: OperatorRegistry,
  token: string,
): OperatorDefinition | undefined {
  return operators[token];
}

/** Return true when a value is an operator token of the requested kind. */
export function has_operator_kind<
  operators extends OperatorRegistry,
  kind extends string,
>(
  operators: operators,
  token: unknown,
  kind: kind,
): token is OperatorsByKind<operators, kind> {
  if (typeof token !== "string") {
    return false;
  }

  return get_operator_from(operators, token)?.kind === kind;
}

/** Return the first registered token with the requested kind. */
export function first_operator_token<
  operators extends OperatorRegistry,
  kind extends string,
>(
  operators: operators,
  kind: kind,
): OperatorsByKind<operators, kind> | undefined {
  for (
    const token of Object.keys(operators) as Array<keyof operators & string>
  ) {
    if (has_operator_kind(operators, token, kind)) {
      return token;
    }
  }

  return undefined;
}

/** Create a numeric binary operator. */
export function number_operator(
  precedence: number,
  direction: InfixDirection,
  fn: (left: number, right: number) => number,
): OperatorDefinition<"number"> {
  return {
    kind: "number",
    precedence,
    direction,
    arity: 2,
    apply(left, right) {
      return fn(as_number(left), as_number(right));
    },
  };
}

/** Create an equality operator. */
export function equality_operator(
  fn: (left: unknown, right: unknown) => boolean = Object.is,
): OperatorDefinition<"equality"> {
  return {
    kind: "equality",
    precedence: 4,
    direction: "none",
    arity: 2,
    apply: fn,
  };
}

/** Create an ordering operator for numeric operands. */
export function ordering_operator(
  fn: (left: number, right: number) => boolean,
): OperatorDefinition<"ordering"> {
  return {
    kind: "ordering",
    precedence: 4,
    direction: "none",
    arity: 2,
    apply(left, right) {
      return fn(as_number(left), as_number(right));
    },
  };
}

/** Create a boolean binary operator. */
export function boolean_operator(
  precedence: number,
  direction: InfixDirection,
  fn: (left: boolean, right: boolean) => boolean,
): OperatorDefinition<"boolean"> {
  return {
    kind: "boolean",
    precedence,
    direction,
    arity: 2,
    apply(left, right) {
      return fn(as_boolean(left), as_boolean(right));
    },
  };
}

/** Create a string binary operator. */
export function string_operator(
  precedence: number,
  direction: InfixDirection,
  fn: (left: string, right: string) => string,
): OperatorDefinition<"string"> {
  return {
    kind: "string",
    precedence,
    direction,
    arity: 2,
    apply(left, right) {
      return fn(as_string(left), as_string(right));
    },
  };
}

/** Number operators included in {@link standard_operators}. */
export type StandardNumberOperatorToken = "+" | "-" | "*" | "/" | "%";

/** Equality operators included in {@link standard_operators}. */
export type StandardEqualityOperatorToken = "==" | "!=";

/** Ordering operators included in {@link standard_operators}. */
export type StandardOrderingOperatorToken = "<" | "<=" | ">" | ">=";

/** Boolean operators included in {@link standard_operators}. */
export type StandardBooleanOperatorToken = "&&" | "||";

/** String operators included in {@link standard_operators}. */
export type StandardStringOperatorToken = "++";

/** Any token included in {@link standard_operators}. */
export type StandardOperatorToken =
  | StandardNumberOperatorToken
  | StandardEqualityOperatorToken
  | StandardOrderingOperatorToken
  | StandardBooleanOperatorToken
  | StandardStringOperatorToken;

/** Registry type for the built-in operators. */
export type StandardOperators =
  & Readonly<
    Record<StandardNumberOperatorToken, OperatorDefinition<"number">>
  >
  & Readonly<
    Record<StandardEqualityOperatorToken, OperatorDefinition<"equality">>
  >
  & Readonly<
    Record<StandardOrderingOperatorToken, OperatorDefinition<"ordering">>
  >
  & Readonly<
    Record<StandardBooleanOperatorToken, OperatorDefinition<"boolean">>
  >
  & Readonly<
    Record<StandardStringOperatorToken, OperatorDefinition<"string">>
  >;

/** Standard numeric, string, comparison, equality, and boolean operators. */
export const standard_operators: StandardOperators = operators({
  "++": string_operator(6, "left", (left, right) => left + right),
  "+": number_operator(6, "left", (left, right) => left + right),
  "-": number_operator(6, "left", (left, right) => left - right),
  "*": number_operator(7, "left", (left, right) => left * right),
  "/": number_operator(7, "left", (left, right) => left / right),
  "%": number_operator(7, "left", (left, right) => left % right),
  "==": equality_operator(),
  "!=": equality_operator((left, right) => !Object.is(left, right)),
  "<": ordering_operator((left, right) => left < right),
  "<=": ordering_operator((left, right) => left <= right),
  ">": ordering_operator((left, right) => left > right),
  ">=": ordering_operator((left, right) => left >= right),
  "&&": boolean_operator(3, "right", (left, right) => left && right),
  "||": boolean_operator(2, "right", (left, right) => left || right),
});

function as_number(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  throw new TypeError("operator expected a number");
}

function as_boolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  throw new TypeError("operator expected a boolean");
}

function as_string(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  throw new TypeError("operator expected a string");
}
