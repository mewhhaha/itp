import { interpreter } from "./interpreter.ts";
import {
  type BinaryOperatorDefinition,
  type InfixDirection,
  type OperatorDefinition,
  unary_operator,
  type UnaryOperatorDefinition,
} from "./operators.ts";

/** Prefix operator declaration understood by {@link op}. */
export type PrefixOperatorDeclaration = `prefix ${number} ?`;

/** Infix operator declaration understood by {@link op}. */
export type InfixOperatorDeclaration =
  | `infix ${number} ?`
  | `infixl ${number} ?`
  | `infixr ${number} ?`;

/** String literal kind marker understood by {@link op}. */
export type OperatorKindLiteral<kind extends string = string> =
  | `'${kind}'`
  | `"${kind}"`;

/** Kind-prefixed prefix operator declaration understood by {@link op}. */
export type KindedPrefixOperatorDeclaration<kind extends string = string> =
  `${OperatorKindLiteral<kind>} | ${PrefixOperatorDeclaration}`;

/** Kind-prefixed infix operator declaration understood by {@link op}. */
export type KindedInfixOperatorDeclaration<kind extends string = string> =
  `${OperatorKindLiteral<kind>} | ${InfixOperatorDeclaration}`;

/** Operator declaration understood by {@link op}. */
export type OperatorDeclaration =
  | PrefixOperatorDeclaration
  | InfixOperatorDeclaration
  | KindedPrefixOperatorDeclaration
  | KindedInfixOperatorDeclaration;

/** Kind inferred from a declaration, or a fallback kind when none is embedded. */
export type OperatorDeclarationKind<
  declaration extends string,
  fallback extends string,
> = declaration extends `'${infer kind}' | ${PrefixOperatorDeclaration}` ? kind
  : declaration extends `"${infer kind}" | ${PrefixOperatorDeclaration}` ? kind
  : declaration extends `'${infer kind}' | ${InfixOperatorDeclaration}` ? kind
  : declaration extends `"${infer kind}" | ${InfixOperatorDeclaration}` ? kind
  : fallback;

/** Options for {@link op}. */
export interface OperatorDeclarationOptions<
  kind extends string = "operator",
> {
  /** Category used for narrowing and lookup helpers. */
  readonly kind?: kind;
}

/** Kind-bound operator declaration helper returned by `op.kind(...)`. */
export type OperatorDeclarationBuilder<kind extends string> = {
  <const declaration extends KindedPrefixOperatorDeclaration, value, result>(
    declaration: declaration,
    fn: (value: value) => result,
  ): UnaryOperatorDefinition<
    OperatorDeclarationKind<declaration, kind>,
    value,
    result
  >;
  <const declaration extends PrefixOperatorDeclaration, value, result>(
    declaration: declaration,
    fn: (value: value) => result,
  ): UnaryOperatorDefinition<kind, value, result>;
  <
    const declaration extends KindedInfixOperatorDeclaration,
    left,
    right,
    result,
  >(
    declaration: declaration,
    fn: (left: left, right: right) => result,
  ): BinaryOperatorDefinition<
    OperatorDeclarationKind<declaration, kind>,
    left,
    right,
    result
  >;
  <const declaration extends InfixOperatorDeclaration, left, right, result>(
    declaration: declaration,
    fn: (left: left, right: right) => result,
  ): BinaryOperatorDefinition<kind, left, right, result>;
  (
    declaration: string,
    fn: (...operands: never[]) => unknown,
  ): OperatorDefinition<kind>;
};

/** Terp-powered operator declaration helper. */
export interface OperatorDeclarationFunction {
  <const declaration extends KindedPrefixOperatorDeclaration, value, result>(
    declaration: declaration,
    fn: (value: value) => result,
  ): UnaryOperatorDefinition<
    OperatorDeclarationKind<declaration, "operator">,
    value,
    result
  >;
  <const declaration extends PrefixOperatorDeclaration, value, result>(
    declaration: declaration,
    fn: (value: value) => result,
  ): UnaryOperatorDefinition<"operator", value, result>;
  <
    const declaration extends PrefixOperatorDeclaration,
    const kind extends string,
    value,
    result,
  >(
    declaration: declaration,
    fn: (value: value) => result,
    options: OperatorDeclarationOptions<kind>,
  ): UnaryOperatorDefinition<kind, value, result>;
  <
    const declaration extends KindedPrefixOperatorDeclaration,
    const kind extends string,
    value,
    result,
  >(
    declaration: declaration,
    fn: (value: value) => result,
    options: OperatorDeclarationOptions<kind>,
  ): UnaryOperatorDefinition<
    OperatorDeclarationKind<declaration, kind>,
    value,
    result
  >;
  <
    const declaration extends KindedInfixOperatorDeclaration,
    left,
    right,
    result,
  >(
    declaration: declaration,
    fn: (left: left, right: right) => result,
  ): BinaryOperatorDefinition<
    OperatorDeclarationKind<declaration, "operator">,
    left,
    right,
    result
  >;
  <const declaration extends InfixOperatorDeclaration, left, right, result>(
    declaration: declaration,
    fn: (left: left, right: right) => result,
  ): BinaryOperatorDefinition<"operator", left, right, result>;
  <
    const declaration extends InfixOperatorDeclaration,
    const kind extends string,
    left,
    right,
    result,
  >(
    declaration: declaration,
    fn: (left: left, right: right) => result,
    options: OperatorDeclarationOptions<kind>,
  ): BinaryOperatorDefinition<kind, left, right, result>;
  <
    const declaration extends KindedInfixOperatorDeclaration,
    const kind extends string,
    left,
    right,
    result,
  >(
    declaration: declaration,
    fn: (left: left, right: right) => result,
    options: OperatorDeclarationOptions<kind>,
  ): BinaryOperatorDefinition<
    OperatorDeclarationKind<declaration, kind>,
    left,
    right,
    result
  >;
  (
    declaration: string,
    fn: (...operands: never[]) => unknown,
  ): OperatorDefinition<"operator">;
  <const kind extends string>(
    declaration: string,
    fn: (...operands: never[]) => unknown,
    options: OperatorDeclarationOptions<kind>,
  ): OperatorDefinition<kind>;
  /** Create a helper that applies one `kind` to every declaration. */
  kind<const kind extends string>(kind: kind): OperatorDeclarationBuilder<kind>;
}

type ParsedOperatorDeclaration =
  | {
    readonly kind?: string;
    readonly arity: 1;
    readonly precedence: number;
  }
  | {
    readonly kind?: string;
    readonly arity: 2;
    readonly precedence: number;
    readonly direction: InfixDirection;
  };

const declaration_interpreter = interpreter({
  infix: unary_operator(
    "operator_declaration",
    8,
    (precedence) => infix("none", precedence),
  ),
  infixl: unary_operator(
    "operator_declaration",
    8,
    (precedence) => infix("left", precedence),
  ),
  infixr: unary_operator(
    "operator_declaration",
    8,
    (precedence) => infix("right", precedence),
  ),
  prefix: unary_operator("operator_declaration", 8, (precedence) => ({
    arity: 1,
    precedence: as_precedence(precedence),
  })),
  "|": {
    kind: "operator_declaration",
    precedence: 1,
    direction: "left",
    arity: 2,
    apply(kind: unknown, definition: unknown): ParsedOperatorDeclaration {
      return {
        ...as_operator_declaration(definition),
        kind: as_kind(kind),
      };
    },
  },
});

/** Create an operator definition from a small fixity declaration DSL. */
export const op = Object.assign(
  (
    declaration: string,
    fn: (...operands: never[]) => unknown,
    options?: OperatorDeclarationOptions<string>,
  ): OperatorDefinition<string> => {
    return operator_definition(declaration, options?.kind ?? "operator", fn);
  },
  {
    kind<const kind extends string>(
      kind: kind,
    ): OperatorDeclarationBuilder<kind> {
      return ((declaration: string, fn: (...operands: never[]) => unknown) => {
        return operator_definition(declaration, kind, fn);
      }) as OperatorDeclarationBuilder<kind>;
    },
  },
) as OperatorDeclarationFunction;

function operator_definition<kind extends string>(
  declaration: string,
  kind: kind,
  fn: (...operands: never[]) => unknown,
): OperatorDefinition<string> {
  const parsed = parse_operator_declaration(declaration);
  const definition_kind = parsed.kind ?? kind;

  switch (parsed.arity) {
    case 1:
      return {
        kind: definition_kind,
        precedence: parsed.precedence,
        arity: 1,
        apply: fn as (value: unknown) => unknown,
      };
    case 2:
      return {
        kind: definition_kind,
        precedence: parsed.precedence,
        direction: parsed.direction,
        arity: 2,
        apply: fn as (left: unknown, right: unknown) => unknown,
      };
  }
}

function parse_operator_declaration(
  declaration: string,
): ParsedOperatorDeclaration {
  const expression = declaration_expression(declaration);
  const runner = declaration_interpreter.raw(expression);

  if (runner instanceof Error) {
    throw new TypeError(
      "operator declaration `" + declaration + "` is invalid: " +
        runner.message,
    );
  }

  const parsed = runner();

  if (!is_parsed_operator_declaration(parsed)) {
    throw new TypeError(
      "operator declaration `" + declaration +
        "` must be `prefix`, `infix`, `infixl`, or `infixr` followed by a precedence and `?`",
    );
  }

  return parsed;
}

function declaration_expression(declaration: string): string {
  const trimmed = declaration.trim();
  const match = /^(.*)\s\?$/.exec(trimmed);

  if (match === null) {
    throw new TypeError(
      "operator declaration `" + declaration + "` must end with `?`",
    );
  }

  const expression = match[1].trimEnd();

  if (expression.length === 0) {
    throw new TypeError(
      "operator declaration `" + declaration +
        "` must include a fixity before `?`",
    );
  }

  return expression;
}

function infix(
  direction: InfixDirection,
  precedence: unknown,
): ParsedOperatorDeclaration {
  return {
    arity: 2,
    precedence: as_precedence(precedence),
    direction,
  };
}

function as_precedence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      "operator declaration precedence must be a finite number",
    );
  }

  return value;
}

function as_kind(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("operator declaration kind must be a string");
  }

  return value;
}

function as_operator_declaration(value: unknown): ParsedOperatorDeclaration {
  if (!is_parsed_operator_declaration(value)) {
    throw new TypeError(
      "operator declaration right side must be an operator declaration",
    );
  }

  return value;
}

function is_parsed_operator_declaration(
  value: unknown,
): value is ParsedOperatorDeclaration {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    readonly kind?: unknown;
    readonly arity?: unknown;
    readonly precedence?: unknown;
    readonly direction?: unknown;
  };

  if (
    candidate.arity !== 1 && candidate.arity !== 2
  ) {
    return false;
  }

  if (typeof candidate.precedence !== "number") {
    return false;
  }

  if (candidate.kind !== undefined && typeof candidate.kind !== "string") {
    return false;
  }

  if (candidate.arity === 1) {
    return true;
  }

  return candidate.direction === "left" ||
    candidate.direction === "right" ||
    candidate.direction === "none";
}
