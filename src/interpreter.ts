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

type StringQuote = "'" | '"';

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

type BalancedParenthesesOutsideStrings<
  text extends string,
  stack extends readonly unknown[] = readonly [],
  quote extends StringQuote | "" = "",
  escaped extends boolean = false,
> = text extends `${infer character}${infer rest}`
  ? quote extends StringQuote
    ? escaped extends true ? BalancedParenthesesOutsideStrings<
        rest,
        stack,
        quote,
        false
      >
    : character extends "\\" ? BalancedParenthesesOutsideStrings<
        rest,
        stack,
        quote,
        true
      >
    : character extends quote ? BalancedParenthesesOutsideStrings<
        rest,
        stack,
        "",
        false
      >
    : BalancedParenthesesOutsideStrings<rest, stack, quote, false>
  : character extends StringQuote ? BalancedParenthesesOutsideStrings<
      rest,
      stack,
      character,
      false
    >
  : character extends "(" ? BalancedParenthesesOutsideStrings<
      rest,
      readonly [unknown, ...stack],
      "",
      false
    >
  : character extends ")"
    ? stack extends readonly [unknown, ...infer remaining]
      ? BalancedParenthesesOutsideStrings<rest, remaining, "", false>
    : false
  : BalancedParenthesesOutsideStrings<rest, stack, "", false>
  : quote extends "" ? stack extends readonly [] ? true
    : false
  : false;

type OperatorBoundary<
  operators extends OperatorRegistry,
  operator extends string,
  left extends string,
  right extends string,
> = BalancedParenthesesOutsideStrings<left> extends true
  ? ContainsOperatorSymbol<operator> extends true
    ? EndsWithOperatorSymbol<left> extends true ? false
    : StartsWithOperatorSymbol<right> extends true
      ? [StartsWithUnaryOperator<operators, right>] extends [never] ? false
      : true
    : true
  : true
  : false;

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

type WordNameRest<text extends string> = text extends "" ? true
  : text extends `${infer character}${infer rest}`
    ? character extends IdentifierPart | "-" ? WordNameRest<rest>
    : false
  : false;

type WordName<text extends string> = text extends
  `${infer character}${infer rest}`
  ? character extends IdentifierStart ? WordNameRest<rest>
  : false
  : false;

type PrefixedWordSyntax<
  text extends string,
  prefixes extends readonly string[],
> = true extends (
  prefixes[number] extends infer prefix extends string
    ? text extends `${prefix}${infer word}` ? WordName<word>
    : false
    : false
) ? true
  : false;

type CallToken<token extends string, rest extends string> = {
  readonly token: token;
  readonly rest: rest;
};

type ReadQuotedCallToken<
  text extends string,
  quote extends StringQuote,
  content extends string = "",
> = text extends `${infer character}${infer rest}`
  ? character extends "\\"
    ? rest extends `${infer escaped}${infer after_escape}`
      ? escaped extends StringEscape ? ReadQuotedCallToken<
          after_escape,
          quote,
          `${content}\\${escaped}`
        >
      : never
    : never
  : character extends quote ? CallToken<`${quote}${content}${quote}`, rest>
  : ReadQuotedCallToken<rest, quote, `${content}${character}`>
  : never;

type ReadPlainCallToken<
  text extends string,
  token extends string = "",
> = text extends "" ? token extends "" ? never
  : CallToken<token, "">
  : text extends `${Whitespace}${infer rest}`
    ? token extends "" ? ReadPlainCallToken<rest>
    : CallToken<token, `${Whitespace}${rest}`>
  : text extends `${infer character}${infer rest}`
    ? ReadPlainCallToken<rest, `${token}${character}`>
  : never;

type ReadCallToken<text extends string> = TrimLeft<text> extends
  `"${infer rest}` ? ReadQuotedCallToken<rest, '"'>
  : TrimLeft<text> extends `'${infer rest}` ? ReadQuotedCallToken<rest, "'">
  : ReadPlainCallToken<TrimLeft<text>>;

type ReferenceSyntax<reference extends string> = Digits<Trim<reference>> extends
  true ? true
  : Identifier<Trim<reference>>;

type StringOperandSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  operand,
> = ValueStringSyntax<operators, values, word_prefixes, operand> extends true
  ? true
  : operand extends string ? IsNever<
      UnaryStringSyntax<operators, values, word_prefixes, Trim<operand>>
    > extends true ? false
    : true
  : false;

type UnaryStringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator = OperatorTokenWithArity<operators, 1>,
> = operator extends string
  ? Trim<expression> extends `${operator}${infer operand}`
    ? StringOperandSyntax<operators, values, word_prefixes, operand> extends
      true ? true
    : never
  : never
  : never;

type ValueStringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
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
    ? [StringSyntax<operators, values, word_prefixes, expression>] extends
      [never] ? false
    : true
  : FunctionCallStringSyntax<
    operators,
    values,
    word_prefixes,
    Trim<operand>
  > extends true ? true
  : false
  : false;

type BinaryStringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator = OperatorTokenWithArity<operators, 2>,
> = operator extends string ? BinaryStringSyntaxForOperator<
    operators,
    values,
    word_prefixes,
    Trim<expression>,
    operator
  >
  : never;

type BinaryStringSyntaxForOperator<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
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
      word_prefixes,
      `${prefix}${left}`,
      right
    > extends infer syntax
      ? [syntax] extends [never] ? BinaryStringSyntaxForOperator<
          operators,
          values,
          word_prefixes,
          right,
          operator,
          `${prefix}${left}${operator}`
        >
      : syntax
    : never
  : BinaryStringSyntaxForOperator<
    operators,
    values,
    word_prefixes,
    right,
    operator,
    `${prefix}${left}${operator}`
  >
  : never;

type BinaryStringHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator = OperatorTokenWithArity<operators, 2>,
> = operator extends string ? BinaryStringHasReferenceForOperator<
    operators,
    values,
    word_prefixes,
    Trim<expression>,
    operator
  >
  : never;

type BinaryStringHasReferenceForOperator<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
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
      word_prefixes,
      `${prefix}${left}`,
      right
    > extends infer syntax
      ? [syntax] extends [never] ? BinaryStringHasReferenceForOperator<
          operators,
          values,
          word_prefixes,
          right,
          operator,
          `${prefix}${left}${operator}`
        >
      : Or<
        ValueExpressionHasReference<
          operators,
          values,
          word_prefixes,
          `${prefix}${left}`
        >,
        ValueExpressionHasReference<operators, values, word_prefixes, right>
      >
    : never
  : BinaryStringHasReferenceForOperator<
    operators,
    values,
    word_prefixes,
    right,
    operator,
    `${prefix}${left}${operator}`
  >
  : never;

type BinaryStringTailSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  left extends string,
  right extends string,
> = [ValueExpressionTailSyntax<operators, values, word_prefixes, left>] extends
  [true]
  ? [ValueExpressionTailSyntax<operators, values, word_prefixes, right>] extends
    [true] ? true
  : never
  : never;

type ValueExpressionTailSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = StringOperandSyntax<operators, values, word_prefixes, expression> extends
  true ? true
  : [BinaryStringSyntax<operators, values, word_prefixes, expression>] extends
    [never] ? false
  : true;

type StringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = StringOperandSyntax<operators, values, word_prefixes, expression> extends
  true ? true
  : BinaryStringSyntax<operators, values, word_prefixes, expression> extends
    never ? never
  : true;

type StringSyntaxMessageFor<expression extends string> = StringSyntaxMessage<
  `\`${expression}\` expected operands separated by registered operators`
>;

type Or<left, right> = left extends true ? true
  : right extends true ? true
  : false;

type IsNever<value> = [value] extends [never] ? true : false;

type StringOperandHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  operand,
> = ValueStringSyntax<operators, values, word_prefixes, operand> extends true
  ? ValueStringHasReference<operators, values, word_prefixes, operand>
  : operand extends string ? IsNever<
      UnaryStringHasReference<operators, values, word_prefixes, Trim<operand>>
    > extends true ? false
    : UnaryStringHasReference<operators, values, word_prefixes, Trim<operand>>
  : false;

type UnaryStringHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator = OperatorTokenWithArity<operators, 1>,
> = operator extends string
  ? Trim<expression> extends `${operator}${infer operand}`
    ? StringOperandHasReference<operators, values, word_prefixes, operand>
  : never
  : never;

type ValueStringHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  operand,
> = operand extends string ? Trim<operand> extends "?" ? true
  : Trim<operand> extends `?${infer reference}` ? ReferenceSyntax<reference>
  : Trim<operand> extends `${number}` ? false
  : Trim<operand> extends "true" | "false" ? false
  : StringLiteral<Trim<operand>> extends true ? false
  : Trim<operand> extends ValueToken<values> ? false
  : Trim<operand> extends ParenthesizedOperatorToken<operators> ? false
  : Trim<operand> extends `(${infer expression})`
    ? StringExpressionHasReference<operators, values, word_prefixes, expression>
  : FunctionCallStringHasReference<
    operators,
    values,
    word_prefixes,
    Trim<operand>
  >
  : false;

type ValueExpressionHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = StringOperandSyntax<operators, values, word_prefixes, expression> extends
  true ? StringOperandHasReference<operators, values, word_prefixes, expression>
  : BinaryStringHasReference<
    operators,
    values,
    word_prefixes,
    expression
  > extends infer has_reference ? [has_reference] extends [never] ? false
    : has_reference extends true ? true
    : false
  : false;

type StringExpressionHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = ValueExpressionHasReference<operators, values, word_prefixes, expression>;

type PositionalPlaceholder = {
  readonly __itp_placeholder: "positional";
};

type NamedScopePlaceholderArg<
  name extends string = string,
  value = never,
> = {
  readonly __itp_placeholder_arg: "scope";
  readonly name: name;
  readonly value: value;
};

type IndexedPlaceholderArg<
  index extends string,
  value = never,
> = {
  readonly __itp_placeholder_arg: "indexed";
  readonly index: index;
  readonly value: value;
};

type TypeEvaluation<
  value,
  args extends readonly unknown[],
> = {
  readonly value: value;
  readonly args: args;
};

type TypeEvaluationValue<evaluation> = evaluation extends
  TypeEvaluation<infer value, readonly unknown[]> ? value
  : unknown;

type TypeEvaluationArgs<evaluation> = evaluation extends
  TypeEvaluation<unknown, infer args> ? args
  : readonly unknown[];

type OperatorApplyParameters<definition> = definition extends {
  apply: (...args: infer args) => unknown;
} ? args
  : readonly unknown[];

type OperatorApplyReturn<definition> = definition extends {
  apply: (...args: infer _args) => infer result;
} ? result
  : unknown;

type TypedOperatorDefinitionForArity<
  entry,
  arity extends 1 | 2,
> = entry extends { readonly arity: arity } ? entry
  : entry extends readonly unknown[]
    ? Extract<entry[number], { readonly arity: arity }>
  : never;

type TypedOperatorDefinition<
  operators extends OperatorRegistry,
  token extends keyof operators & string,
  arity extends 1 | 2,
> = TypedOperatorDefinitionForArity<operators[token], arity>;

type UnaryInput<definition> = OperatorApplyParameters<definition> extends [
  infer value,
  ...unknown[],
] ? value
  : unknown;

type UnaryOutput<definition> = OperatorApplyReturn<definition>;

type BinaryLeft<definition> = OperatorApplyParameters<definition> extends [
  infer left,
  unknown,
  ...unknown[],
] ? left
  : unknown;

type BinaryRight<definition> = OperatorApplyParameters<definition> extends [
  unknown,
  infer right,
  ...unknown[],
] ? right
  : unknown;

type BinaryOutput<definition> = OperatorApplyReturn<definition>;

type ConstrainEvaluation<
  evaluation,
  expected,
> = evaluation extends TypeEvaluation<infer value, infer args>
  ? value extends PositionalPlaceholder
    ? TypeEvaluation<expected, ConstrainPlaceholderArgs<args, expected>>
  : evaluation
  : TypeEvaluation<unknown, readonly unknown[]>;

type ConstrainPlaceholderArgs<
  args extends readonly unknown[],
  expected,
> = args extends readonly [
  {
    readonly __itp_placeholder_arg: "indexed";
    readonly index: infer index extends string;
  },
] ? readonly [IndexedPlaceholderArg<index, expected>]
  : args extends readonly [
    {
      readonly __itp_placeholder_arg: "scope";
      readonly name: infer name extends string;
    },
  ] ? readonly [NamedScopePlaceholderArg<name, expected>]
  : args extends readonly [unknown] ? readonly [expected]
  : args;

type HasNamedScopeArg<args extends readonly unknown[]> = args extends readonly [
  infer head,
  ...infer tail,
] ? head extends { readonly __itp_placeholder_arg: "scope" } ? true
  : HasNamedScopeArg<tail>
  : false;

type NamedArgNames<args extends readonly unknown[]> = args extends readonly [
  infer head,
  ...infer tail,
] ? head extends {
    readonly __itp_placeholder_arg: "scope";
    readonly name: infer name extends string;
  } ? name | NamedArgNames<tail>
  : NamedArgNames<tail>
  : never;

type NamedValueFor<
  args extends readonly unknown[],
  name extends string,
  found extends readonly [unknown] | undefined = undefined,
> = args extends readonly [infer head, ...infer tail] ? head extends {
    readonly __itp_placeholder_arg: "scope";
    readonly name: name;
    readonly value: infer value;
  } ? NamedValueFor<tail, name, MergePlaceholderValue<found, value>>
  : NamedValueFor<tail, name, found>
  : found extends readonly [infer result] ? result
  : unknown;

type NamedScopeArgs<args extends readonly unknown[]> = {
  readonly [name in NamedArgNames<args>]: NamedValueFor<args, name>;
};

type HasIndexedArg<
  args extends readonly unknown[],
  index extends string,
> = args extends readonly [infer head, ...infer tail] ? head extends {
    readonly __itp_placeholder_arg: "indexed";
    readonly index: index;
  } ? true
  : HasIndexedArg<tail, index>
  : false;

type IndexedValueFor<
  args extends readonly unknown[],
  index extends string,
  found extends readonly [unknown] | undefined = undefined,
> = args extends readonly [infer head, ...infer tail] ? head extends {
    readonly __itp_placeholder_arg: "indexed";
    readonly index: index;
    readonly value: infer value;
  } ? IndexedValueFor<tail, index, MergePlaceholderValue<found, value>>
  : IndexedValueFor<tail, index, found>
  : found extends readonly [infer result] ? result
  : unknown;

type MergePlaceholderValue<
  found extends readonly [unknown] | undefined,
  value,
> = found extends readonly [infer current]
  ? readonly [current & ([value] extends [never] ? unknown : value)]
  : readonly [[value] extends [never] ? unknown : value];

type IndexedArgs<args extends readonly unknown[]> = HasIndexedArg<
  args,
  "9"
> extends true ? readonly [
    IndexedValueFor<args, "0">,
    IndexedValueFor<args, "1">,
    IndexedValueFor<args, "2">,
    IndexedValueFor<args, "3">,
    IndexedValueFor<args, "4">,
    IndexedValueFor<args, "5">,
    IndexedValueFor<args, "6">,
    IndexedValueFor<args, "7">,
    IndexedValueFor<args, "8">,
    IndexedValueFor<args, "9">,
  ]
  : HasIndexedArg<args, "8"> extends true ? readonly [
      IndexedValueFor<args, "0">,
      IndexedValueFor<args, "1">,
      IndexedValueFor<args, "2">,
      IndexedValueFor<args, "3">,
      IndexedValueFor<args, "4">,
      IndexedValueFor<args, "5">,
      IndexedValueFor<args, "6">,
      IndexedValueFor<args, "7">,
      IndexedValueFor<args, "8">,
    ]
  : HasIndexedArg<args, "7"> extends true ? readonly [
      IndexedValueFor<args, "0">,
      IndexedValueFor<args, "1">,
      IndexedValueFor<args, "2">,
      IndexedValueFor<args, "3">,
      IndexedValueFor<args, "4">,
      IndexedValueFor<args, "5">,
      IndexedValueFor<args, "6">,
      IndexedValueFor<args, "7">,
    ]
  : HasIndexedArg<args, "6"> extends true ? readonly [
      IndexedValueFor<args, "0">,
      IndexedValueFor<args, "1">,
      IndexedValueFor<args, "2">,
      IndexedValueFor<args, "3">,
      IndexedValueFor<args, "4">,
      IndexedValueFor<args, "5">,
      IndexedValueFor<args, "6">,
    ]
  : HasIndexedArg<args, "5"> extends true ? readonly [
      IndexedValueFor<args, "0">,
      IndexedValueFor<args, "1">,
      IndexedValueFor<args, "2">,
      IndexedValueFor<args, "3">,
      IndexedValueFor<args, "4">,
      IndexedValueFor<args, "5">,
    ]
  : HasIndexedArg<args, "4"> extends true ? readonly [
      IndexedValueFor<args, "0">,
      IndexedValueFor<args, "1">,
      IndexedValueFor<args, "2">,
      IndexedValueFor<args, "3">,
      IndexedValueFor<args, "4">,
    ]
  : HasIndexedArg<args, "3"> extends true ? readonly [
      IndexedValueFor<args, "0">,
      IndexedValueFor<args, "1">,
      IndexedValueFor<args, "2">,
      IndexedValueFor<args, "3">,
    ]
  : HasIndexedArg<args, "2"> extends true ? readonly [
      IndexedValueFor<args, "0">,
      IndexedValueFor<args, "1">,
      IndexedValueFor<args, "2">,
    ]
  : HasIndexedArg<args, "1"> extends true ? readonly [
      IndexedValueFor<args, "0">,
      IndexedValueFor<args, "1">,
    ]
  : HasIndexedArg<args, "0"> extends true ? readonly [
      IndexedValueFor<args, "0">,
    ]
  : readonly [];

type SequentialArgs<args extends readonly unknown[]> = args extends readonly [
  infer head,
  ...infer tail,
]
  ? head extends { readonly __itp_placeholder_arg: "indexed" | "scope" }
    ? SequentialArgs<tail>
  : readonly [head, ...SequentialArgs<tail>]
  : readonly [];

type NormalizePlaceholderArgs<
  args extends readonly unknown[],
> = number extends args["length"] ? readonly unknown[]
  : HasNamedScopeArg<args> extends true ? readonly [
      NamedScopeArgs<args>,
      ...IndexedArgs<args>,
      ...SequentialArgs<args>,
    ]
  : readonly [...IndexedArgs<args>, ...SequentialArgs<args>];

type TypeApplyUnary<
  definition,
  operand,
  constrained = ConstrainEvaluation<operand, UnaryInput<definition>>,
> = TypeEvaluationMatches<constrained, UnaryInput<definition>> extends true
  ? TypeEvaluation<
    UnaryOutput<definition>,
    TypeEvaluationArgs<constrained>
  >
  : never;

type TypeApplyBinary<
  definition,
  left,
  right,
  constrained_left = ConstrainEvaluation<left, BinaryLeft<definition>>,
  constrained_right = ConstrainEvaluation<right, BinaryRight<definition>>,
> = TypeEvaluationMatches<constrained_left, BinaryLeft<definition>> extends true
  ? TypeEvaluationMatches<constrained_right, BinaryRight<definition>> extends
    true ? TypeEvaluation<
      BinaryOutput<definition>,
      readonly [
        ...TypeEvaluationArgs<constrained_left>,
        ...TypeEvaluationArgs<constrained_right>,
      ]
    >
  : never
  : never;

type TypeEvaluationMatches<
  evaluation,
  expected,
> = [evaluation] extends [never] ? false
  : TypeMatches<TypeEvaluationValue<evaluation>, expected>;

type TypeMatches<value, expected> = unknown extends value ? true
  : [value] extends [expected] ? true
  : false;

type FunctionCallStringSyntax<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = IsNever<
  TypeEvaluateFunctionCall<operators, values, word_prefixes, expression>
> extends true ? false
  : true;

type FunctionCallStringHasReference<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = TypeEvaluateFunctionCall<
  operators,
  values,
  word_prefixes,
  expression
> extends infer evaluation ? [evaluation] extends [never] ? false
  : TypeEvaluationArgs<evaluation> extends readonly [] ? false
  : true
  : false;

type TypeEvaluateFunctionCall<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = ReadCallToken<TrimLeft<expression>> extends CallToken<
  infer name,
  infer rest
> ? Trim<rest> extends "" ? never
  : Identifier<Trim<name>> extends true
    ? Trim<name> extends ValueToken<values>
      ? values[Trim<name>] extends (...args: infer parameters) => infer result
        ? TypeApplyValueFunction<
          parameters,
          result,
          TypeEvaluateWordArguments<operators, values, word_prefixes, rest>
        >
      : never
    : never
  : never
  : never;

type TypeEvaluateWordArguments<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  text extends string,
  parsed extends readonly unknown[] = readonly [],
> = Trim<text> extends "" ? parsed
  : ReadCallToken<text> extends CallToken<infer token, infer rest>
    ? TypeEvaluateWordArgument<operators, values, word_prefixes, token> extends
      infer argument ? [argument] extends [never] ? never
      : TypeEvaluateWordArguments<
        operators,
        values,
        word_prefixes,
        rest,
        readonly [...parsed, argument]
      >
    : never
  : never;

type TypeEvaluateWordArgument<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  token extends string,
> = Trim<token> extends "?" | `?${string}`
  ? TypeEvaluateValue<operators, values, word_prefixes, token>
  : Trim<token> extends `${number}` ? TypeEvaluation<number, readonly []>
  : Trim<token> extends "true" | "false" ? TypeEvaluation<boolean, readonly []>
  : StringLiteral<Trim<token>> extends true
    ? TypeEvaluation<string, readonly []>
  : PrefixedWordSyntax<Trim<token>, word_prefixes> extends true
    ? TypeEvaluation<string, readonly []>
  : Trim<token> extends ValueToken<values>
    ? TypeEvaluation<values[Trim<token>], readonly []>
  : Identifier<Trim<token>> extends true ? TypeEvaluation<string, readonly []>
  : Trim<token> extends ParenthesizedOperatorToken<operators>
    ? TypeEvaluateValue<operators, values, word_prefixes, token>
  : Trim<token> extends `(${string})`
    ? TypeEvaluateValue<operators, values, word_prefixes, token>
  : never;

type TypeApplyValueFunction<
  parameters extends readonly unknown[],
  result,
  arguments_evaluation extends readonly unknown[],
  constrained_arguments = ConstrainFunctionArguments<
    arguments_evaluation,
    parameters
  >,
> = [constrained_arguments] extends [never] ? never
  : constrained_arguments extends readonly unknown[]
    ? FunctionArgumentValues<constrained_arguments> extends parameters
      ? TypeEvaluation<
        result,
        FunctionPlaceholderArgs<constrained_arguments>
      >
    : never
  : never;

type ConstrainFunctionArguments<
  arguments_evaluation extends readonly unknown[],
  parameters extends readonly unknown[],
> = number extends parameters["length"]
  ? ConstrainFunctionRestArguments<arguments_evaluation, parameters[number]>
  : arguments_evaluation extends readonly [infer argument, ...infer rest]
    ? parameters extends readonly [infer parameter, ...infer parameter_rest]
      ? readonly [
        ConstrainEvaluation<argument, parameter>,
        ...ConstrainFunctionArguments<rest, parameter_rest>,
      ]
    : never
  : readonly [];

type ConstrainFunctionRestArguments<
  arguments_evaluation extends readonly unknown[],
  parameter,
> = arguments_evaluation extends readonly [infer argument, ...infer rest]
  ? readonly [
    ConstrainEvaluation<argument, parameter>,
    ...ConstrainFunctionRestArguments<rest, parameter>,
  ]
  : readonly [];

type FunctionArgumentValues<arguments_evaluation extends readonly unknown[]> =
  arguments_evaluation extends readonly [infer argument, ...infer rest]
    ? argument extends TypeEvaluation<infer value, readonly unknown[]>
      ? [value, ...FunctionArgumentValues<rest>]
    : never
    : [];

type FunctionPlaceholderArgs<arguments_evaluation extends readonly unknown[]> =
  arguments_evaluation extends readonly [infer argument, ...infer rest]
    ? readonly [
      ...TypeEvaluationArgs<argument>,
      ...FunctionPlaceholderArgs<rest>,
    ]
    : readonly [];

type TypeEvaluateOperand<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  operand,
> = ValueStringSyntax<operators, values, word_prefixes, operand> extends true
  ? TypeEvaluateValue<operators, values, word_prefixes, operand>
  : operand extends string ? TypeEvaluateUnary<
      operators,
      values,
      word_prefixes,
      Trim<operand>
    >
  : TypeEvaluation<unknown, readonly unknown[]>;

type TypeEvaluateUnary<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator = OperatorTokenWithArity<operators, 1>,
> = operator extends keyof operators & string
  ? Trim<expression> extends `${operator}${infer operand}`
    ? StringOperandSyntax<operators, values, word_prefixes, operand> extends
      true ? TypeApplyUnary<
        TypedOperatorDefinition<operators, operator, 1>,
        TypeEvaluateOperand<operators, values, word_prefixes, operand>
      >
    : never
  : never
  : never;

type TypeEvaluateValue<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  operand,
> = operand extends string
  ? Trim<operand> extends "?"
    ? TypeEvaluation<PositionalPlaceholder, readonly [unknown]>
  : Trim<operand> extends `?${infer reference}`
    ? ReferenceSyntax<reference> extends true
      ? Digits<Trim<reference>> extends true
        ? Trim<reference> extends Digit ? TypeEvaluation<
            PositionalPlaceholder,
            readonly [IndexedPlaceholderArg<Trim<reference>>]
          >
        : TypeEvaluation<unknown, readonly unknown[]>
      : TypeEvaluation<
        PositionalPlaceholder,
        readonly [NamedScopePlaceholderArg<Trim<reference>>]
      >
    : TypeEvaluation<unknown, readonly unknown[]>
  : Trim<operand> extends `${number}` ? TypeEvaluation<number, readonly []>
  : Trim<operand> extends "true" | "false"
    ? TypeEvaluation<boolean, readonly []>
  : StringLiteral<Trim<operand>> extends true
    ? TypeEvaluation<string, readonly []>
  : Trim<operand> extends ValueToken<values>
    ? TypeEvaluation<values[Trim<operand>], readonly []>
  : Trim<operand> extends `(${infer token})`
    ? token extends OperatorToken<operators>
      ? TypeEvaluation<operators[token], readonly []>
    : Trim<operand> extends `(${infer expression})`
      ? TypeEvaluateExpression<operators, values, word_prefixes, expression>
    : TypeEvaluation<unknown, readonly unknown[]>
  : FunctionCallStringSyntax<
    operators,
    values,
    word_prefixes,
    Trim<operand>
  > extends true
    ? TypeEvaluateFunctionCall<operators, values, word_prefixes, Trim<operand>>
  : TypeEvaluation<unknown, readonly unknown[]>
  : TypeEvaluation<unknown, readonly unknown[]>;

type TypeEvaluateBinary<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator = OperatorTokenWithArity<operators, 2>,
> = TypeEvaluateBinaryLeft<
  operators,
  values,
  word_prefixes,
  expression,
  operator
> extends infer left_evaluation
  ? [left_evaluation] extends [never] ? TypeEvaluateBinaryRight<
      operators,
      values,
      word_prefixes,
      expression,
      operator
    >
  : left_evaluation
  : never;

type TypeEvaluateBinaryLeft<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator = OperatorTokenWithArity<operators, 2>,
> = operator extends keyof operators & string
  ? TypeEvaluateBinaryLeftForOperator<
    operators,
    values,
    word_prefixes,
    Trim<expression>,
    operator
  >
  : never;

type TypeEvaluateBinaryRight<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator = OperatorTokenWithArity<operators, 2>,
> = operator extends keyof operators & string
  ? TypeEvaluateBinaryRightForOperator<
    operators,
    values,
    word_prefixes,
    Trim<expression>,
    operator
  >
  : never;

type TypeEvaluateBinaryRightForOperator<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator extends keyof operators & string,
  prefix extends string = "",
> = expression extends `${infer left}${operator}${infer right}`
  ? OperatorBoundary<
    operators,
    operator,
    `${prefix}${left}`,
    right
  > extends true ? TypeEvaluateBinaryTail<
      operators,
      values,
      word_prefixes,
      operator,
      `${prefix}${left}`,
      right
    > extends infer evaluation
      ? [evaluation] extends [never] ? TypeEvaluateBinaryRightForOperator<
          operators,
          values,
          word_prefixes,
          right,
          operator,
          `${prefix}${left}${operator}`
        >
      : evaluation
    : never
  : TypeEvaluateBinaryRightForOperator<
    operators,
    values,
    word_prefixes,
    right,
    operator,
    `${prefix}${left}${operator}`
  >
  : never;

type TypeEvaluateBinaryLeftForOperator<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  operator extends keyof operators & string,
  prefix extends string = "",
> = expression extends `${infer left}${operator}${infer right}`
  ? OperatorBoundary<
    operators,
    operator,
    `${prefix}${left}`,
    right
  > extends true ? TypeEvaluateBinaryLeftForOperator<
      operators,
      values,
      word_prefixes,
      right,
      operator,
      `${prefix}${left}${operator}`
    > extends infer later
      ? [later] extends [never] ? TypeEvaluateBinaryLeftTail<
          operators,
          values,
          word_prefixes,
          operator,
          `${prefix}${left}`,
          right
        >
      : later
    : never
  : TypeEvaluateBinaryLeftForOperator<
    operators,
    values,
    word_prefixes,
    right,
    operator,
    `${prefix}${left}${operator}`
  >
  : never;

type TypeEvaluateBinaryTail<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  operator extends keyof operators & string,
  left extends string,
  right extends string,
> = [ValueExpressionTailSyntax<operators, values, word_prefixes, left>] extends
  [true]
  ? [ValueExpressionTailSyntax<operators, values, word_prefixes, right>] extends
    [true] ? TypeApplyBinary<
      TypedOperatorDefinition<operators, operator, 2>,
      TypeEvaluateExpression<operators, values, word_prefixes, left>,
      TypeEvaluateExpression<operators, values, word_prefixes, right>
    >
  : never
  : never;

type TypeEvaluateBinaryLeftTail<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  operator extends keyof operators & string,
  left extends string,
  right extends string,
> = [ValueExpressionTailSyntax<operators, values, word_prefixes, left>] extends
  [true]
  ? [ValueExpressionTailSyntax<operators, values, word_prefixes, right>] extends
    [true] ? TypeApplyBinary<
      TypedOperatorDefinition<operators, operator, 2>,
      TypeEvaluateExpression<operators, values, word_prefixes, left>,
      TypeEvaluateExpression<operators, values, word_prefixes, right>
    >
  : never
  : never;

type TypeEvaluateExpression<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = StringOperandSyntax<operators, values, word_prefixes, expression> extends
  true ? TypeEvaluateOperand<operators, values, word_prefixes, expression>
  : BinaryStringSyntax<operators, values, word_prefixes, expression> extends
    never ? TypeEvaluation<unknown, readonly unknown[]>
  : TypeEvaluateBinary<operators, values, word_prefixes, expression>;

/** @internal */
export type StringExpressionType<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  word_prefixes extends readonly string[] = readonly [],
> = NormalizeExpressionType<
  TypeEvaluationValue<
    TypeEvaluateExpression<operators, values, word_prefixes, expression>
  >
>;

type NormalizeExpressionType<value> = value extends PositionalPlaceholder
  ? unknown
  : value;

type HasLiteralOperatorTokens<operators extends OperatorRegistry> =
  string extends OperatorToken<operators> ? false : true;

/** @internal */
export type StringExpressionArgs<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  expression extends string,
  word_prefixes extends readonly string[] = readonly [],
> = string extends expression ? readonly unknown[]
  : HasLiteralOperatorTokens<operators> extends false ? readonly unknown[]
  : NormalizePlaceholderArgs<
    TypeEvaluationArgs<
      TypeEvaluateExpression<operators, values, word_prefixes, expression>
    >
  >;

type StringTypeMessageFor<expression extends string> = StringSyntaxMessage<
  `\`${expression}\` has operands that do not match registered operator types`
>;

/** @internal */
type StringCallResult<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
  rest extends readonly unknown[],
> = string extends expression ? unknown
  : HasLiteralOperatorTokens<operators> extends false ? unknown
  : StringSyntax<operators, values, word_prefixes, expression> extends never
    ? StringSyntaxMessageFor<expression>
  : TypeEvaluateExpression<operators, values, word_prefixes, expression> extends
    infer evaluation ? [evaluation] extends [never] ? StringTypeMessageFor<
        expression
      >
    : rest extends readonly [] ? StringExpressionHasReference<
        operators,
        values,
        word_prefixes,
        expression
      > extends true
        ? StringRunner<operators, expression, values, word_prefixes>
      : FunctionCallStringSyntax<
        operators,
        values,
        word_prefixes,
        expression
      > extends true ? StringExpressionType<
          operators,
          values,
          expression,
          word_prefixes
        >
      : unknown
    : StringExpressionType<operators, values, expression, word_prefixes>
  : StringTypeMessageFor<expression>;

/** @internal */
type DirectStringCallResult<
  operators extends OperatorRegistry,
  values extends ValueRegistry,
  word_prefixes extends readonly string[],
  expression extends string,
> = string extends expression ? unknown
  : HasLiteralOperatorTokens<operators> extends false ? unknown
  : StringSyntax<operators, values, word_prefixes, expression> extends never
    ? StringSyntaxMessageFor<expression>
  : TypeEvaluateExpression<operators, values, word_prefixes, expression> extends
    infer evaluation ? [evaluation] extends [never] ? StringTypeMessageFor<
        expression
      >
    : StringExpressionType<operators, values, expression, word_prefixes>
  : StringTypeMessageFor<expression>;

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
  _values extends ValueRegistry = EmptyValueRegistry,
  _word_prefixes extends readonly string[] = readonly [],
> = (
  ...values: StringExpressionArgs<
    _operators,
    _values,
    _expression,
    _word_prefixes
  >
) => StringExpressionType<_operators, _values, _expression, _word_prefixes>;

/** Runtime-only expression runner returned by {@link Interpreter.raw}. */
export type RawStringRunner = (...values: unknown[]) => unknown;

/** Result of compiling a runtime-only expression with {@link Interpreter.raw}. */
export type RawStringResult = RawStringRunner | InterpreterError;

/**
 * Runtime expression fragment validated by {@link Interpreter.fragment}.
 *
 * Fragments stringify to their original expression so they can be composed in
 * template strings and then compiled with {@link Interpreter.raw}.
 */
export type ExpressionFragment = {
  /** Original validated expression text. */
  readonly expression: string;
  /** Return the original validated expression text. */
  toString(): string;
};

/** Result of validating a runtime expression fragment. */
export type ExpressionFragmentResult = ExpressionFragment | InterpreterError;

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
  word_prefixes extends readonly string[] = readonly [],
> {
  /** Override operator application while preserving parsing and precedence. */
  readonly apply_operator?: InterpreterApplyOperator;
  /** Named values that can be referenced directly from expressions. */
  readonly values?: values;
  /** Prefix strings recognized for words passed to callable values.
   *
   * Default: []
   */
  readonly word_prefixes?: word_prefixes;
}

type RuntimeInterpreterOptions = InterpreterOptions<
  ValueRegistry,
  readonly string[]
>;

/** Callable interpreter with its operator registry attached. */
export type Interpreter<
  operators extends OperatorRegistry,
  values extends ValueRegistry = EmptyValueRegistry,
  word_prefixes extends readonly string[] = readonly [],
> = {
  readonly operators: operators;
  readonly values: values;
  get<const token extends keyof operators & string>(
    token: token,
  ): operators[token];
  get(token: string): OperatorEntry | undefined;
  get_value<const name extends keyof values & string>(name: name): values[name];
  get_value(name: string): unknown | undefined;
  /** Validate a runtime expression string for later composition. */
  fragment(expression: string): ExpressionFragmentResult;
  /** Create a reusable runner from a dynamic expression string. */
  raw(expression: string): RawStringResult;
  /** Compose validated expression fragments and create a reusable runner. */
  raw(
    strings: TemplateStringsArray,
    ...fragments: readonly ExpressionFragment[]
  ): RawStringResult;
  <const expression extends string>(
    expression: CheckedArgument<
      expression,
      StringCallResult<
        operators,
        values,
        word_prefixes,
        expression,
        readonly []
      >
    >,
  ): CheckedResult<
    StringCallResult<operators, values, word_prefixes, expression, readonly []>
  >;
  <const expression extends string>(
    expression: CheckedArgument<
      expression,
      DirectStringCallResult<operators, values, word_prefixes, expression>
    >,
    ...rest: StringExpressionArgs<operators, values, expression, word_prefixes>
  ): CheckedResult<
    DirectStringCallResult<operators, values, word_prefixes, expression>
  >;
};

/** Create a callable interpreter from an operator registry. */
export function interpreter<
  const operators extends OperatorRegistry,
  const values extends ValueRegistry = EmptyValueRegistry,
  const word_prefixes extends readonly string[] = readonly [],
>(
  operators: operators,
  options: InterpreterOptions<values, word_prefixes> = {},
): Interpreter<operators, values, word_prefixes> {
  operator_registry(operators);
  const named_values = options.values ?? ({} as values);
  validate_value_registry(operators, named_values);
  const configured_word_prefixes = options.word_prefixes ?? [];

  const interpreter = ((expression: string, ...substitutions: unknown[]) => {
    return interpret_string_expression(
      operators,
      named_values,
      expression,
      substitutions,
      options,
      configured_word_prefixes,
    );
  }) as unknown as Interpreter<operators, values, word_prefixes>;

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
  Object.defineProperty(interpreter, "fragment", {
    value(expression: string): ExpressionFragmentResult {
      const error = validate_raw_string_expression(
        operators,
        named_values,
        expression,
        configured_word_prefixes,
      );

      if (error !== undefined) {
        return error;
      }

      return expression_fragment(operators, named_values, expression);
    },
    enumerable: false,
  });
  Object.defineProperty(interpreter, "raw", {
    value(
      expression: string | TemplateStringsArray,
      ...fragments: readonly ExpressionFragment[]
    ): RawStringResult {
      if (typeof expression !== "string") {
        const composed = compose_fragment_template(
          operators,
          named_values,
          expression,
          fragments,
        );

        if (composed instanceof InterpreterError) {
          return composed;
        }

        expression = composed;
      }

      const error = validate_raw_string_expression(
        operators,
        named_values,
        expression,
        configured_word_prefixes,
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
          configured_word_prefixes,
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
  /** High-water mark of consumed positional slots. */
  value_index: number;
  /** Next slot read by an anonymous `?`; starts after the indexed block. */
  positional_index: number;
  readonly word_prefixes: readonly string[];
};

const raw_validation_value = Symbol("terp.raw.validation.value");
const expression_fragment_brand = Symbol("terp.expression.fragment");

type ExpressionFragmentMetadata = {
  readonly operators: OperatorRegistry;
  readonly named_values: ValueRegistry;
};

type InternalExpressionFragment = ExpressionFragment & {
  readonly [expression_fragment_brand]: ExpressionFragmentMetadata;
};

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
  options: RuntimeInterpreterOptions,
  word_prefixes: readonly string[] = [],
): unknown {
  if (
    substitutions.length === 0 &&
    scan_references(operators, named_values, expression, word_prefixes)
      .has_reference
  ) {
    return (...values: readonly unknown[]) => {
      return evaluate_string_expression(
        operators,
        named_values,
        expression,
        values,
        options,
        word_prefixes,
      );
    };
  }

  return evaluate_string_expression(
    operators,
    named_values,
    expression,
    substitutions,
    options,
    word_prefixes,
  );
}

function evaluate_string_expression(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
  substitutions: readonly unknown[],
  options: RuntimeInterpreterOptions,
  word_prefixes: readonly string[] = [],
): unknown {
  const references = scan_references(
    operators,
    named_values,
    expression,
    word_prefixes,
  );
  const scope = references.has_named_reference ? substitutions[0] : undefined;
  const values = references.has_named_reference
    ? substitutions.slice(1)
    : substitutions;
  const context: TokenizeContext = {
    named_values,
    scope,
    values,
    resolve_references: true,
    word_prefixes,
    value_index: 0,
    positional_index: references.next_positional_index,
  };

  const result = evaluate_text(
    operators,
    expression,
    context,
    options,
    word_prefixes,
  );

  if (context.value_index < values.length) {
    throw new TypeError("interpreter expression received too many values");
  }

  return result;
}

function validate_raw_string_expression(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
  word_prefixes: readonly string[] = [],
): InterpreterError | undefined {
  const context: TokenizeContext = {
    named_values,
    scope: undefined,
    values: [],
    resolve_references: false,
    word_prefixes,
    value_index: 0,
    positional_index: 0,
  };

  try {
    evaluate_text(
      operators,
      expression,
      context,
      {
        apply_operator() {
          return raw_validation_value;
        },
      },
      word_prefixes,
    );
  } catch (error) {
    return interpreter_error_from(error);
  }

  return undefined;
}

function expression_fragment(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
): ExpressionFragment {
  const fragment = {
    expression,
    toString() {
      return expression;
    },
  } as InternalExpressionFragment;

  Object.defineProperty(fragment, expression_fragment_brand, {
    value: { operators, named_values },
    enumerable: false,
  });

  return Object.freeze(fragment);
}

function compose_fragment_template(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  strings: TemplateStringsArray,
  fragments: readonly ExpressionFragment[],
): string | InterpreterError {
  if (!Array.isArray(strings)) {
    return interpreter_error_from(
      new TypeError("interpreter raw template expected a string array"),
    );
  }

  if (strings.length !== fragments.length + 1) {
    return interpreter_error_from(
      new TypeError(
        "interpreter raw template expected one more string than fragment",
      ),
    );
  }

  for (const text of strings) {
    if (typeof text !== "string") {
      return interpreter_error_from(
        new TypeError("interpreter raw template expected string chunks"),
      );
    }
  }

  let expression = strings[0];

  for (let index = 0; index < fragments.length; index += 1) {
    const metadata = expression_fragment_metadata(fragments[index]);

    if (
      metadata === undefined ||
      metadata.operators !== operators ||
      metadata.named_values !== named_values
    ) {
      return interpreter_error_from(
        new TypeError(
          "interpreter raw template interpolations must be fragments from " +
            "this interpreter",
        ),
      );
    }

    expression += fragments[index].expression + strings[index + 1];
  }

  return expression;
}

function expression_fragment_metadata(
  fragment: ExpressionFragment,
): ExpressionFragmentMetadata | undefined {
  if (typeof fragment !== "object" || fragment === null) {
    return undefined;
  }

  const metadata = (fragment as Partial<InternalExpressionFragment>)[
    expression_fragment_brand
  ];

  if (
    typeof metadata !== "object" ||
    metadata === null ||
    metadata.operators === undefined ||
    metadata.named_values === undefined
  ) {
    return undefined;
  }

  return metadata;
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
  options: RuntimeInterpreterOptions,
  word_prefixes: readonly string[] = [],
): unknown {
  const tokens = tokenize_text(
    operators,
    text,
    context,
    options,
    true,
    word_prefixes,
  );

  return evaluate_tokens(tokens.tokens, options);
}

function tokenize_text(
  operators: OperatorRegistry,
  text: string,
  context: TokenizeContext,
  options: RuntimeInterpreterOptions,
  expecting_value: boolean,
  word_prefixes: readonly string[] = [],
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

      const value = read_value(
        operators,
        text,
        index,
        context,
        options,
        word_prefixes,
      );

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
  options: RuntimeInterpreterOptions,
  word_prefixes: readonly string[] = [],
): { readonly value: unknown; readonly next: number } | undefined {
  if (text[index] === "?") {
    return read_reference(text, index, context);
  }

  const literal = read_literal(text, index);

  if (literal !== undefined) {
    return literal;
  }

  const call = read_value_function_call(
    operators,
    text,
    index,
    context,
    options,
    word_prefixes,
  );
  if (call !== undefined) {
    return call;
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

/**
 * Call functions registered in `values` with following space-separated words.
 * Bare names with no following words still evaluate to the function itself.
 */
function read_value_function_call(
  operators: OperatorRegistry,
  text: string,
  index: number,
  context: TokenizeContext,
  options: RuntimeInterpreterOptions,
  word_prefixes: readonly string[] = [],
): { readonly value: unknown; readonly next: number } | undefined {
  const ident = read_identifier(text, index);
  if (ident === undefined) {
    return undefined;
  }

  const candidate = context.named_values[ident.name];
  if (typeof candidate !== "function") {
    return undefined;
  }

  const words: unknown[] = [];
  let next = ident.next;

  while (next < text.length) {
    const word_start = skip_whitespace(text, next);
    if (word_start === next || word_start >= text.length) {
      break;
    }

    next = word_start;

    if (read_operator(operators, text, next, 2, true) !== undefined) {
      break;
    }

    const word = read_word_value(
      text,
      next,
      context,
      options,
      operators,
      word_prefixes,
    );
    if (word !== undefined) {
      words.push(word.value);
      next = word.next;
      continue;
    }

    break;
  }

  if (words.length === 0) {
    return undefined;
  }

  if (!context.resolve_references) {
    return { value: raw_validation_value, next };
  }

  const result = candidate(...words);
  return { value: result, next };
}

function read_word_value(
  text: string,
  index: number,
  context: TokenizeContext,
  options: RuntimeInterpreterOptions,
  operators: OperatorRegistry,
  word_prefixes: readonly string[] = [],
): { readonly value: unknown; readonly next: number } | undefined {
  if (text[index] === "?") {
    return read_reference(text, index, context);
  }

  const prefixed = read_prefixed_word(text, index, word_prefixes);
  if (prefixed !== undefined) return prefixed;

  const lit = read_literal(text, index);
  if (lit !== undefined) return lit;

  const named = read_named_value(context.named_values, text, index);
  if (named !== undefined) return named;

  const bare = read_identifier(text, index);
  if (bare !== undefined) {
    return { value: bare.name, next: bare.next };
  }

  return read_parenthesized_operator_value(operators, text, index) ??
    read_parenthesized_expression(operators, text, index, context, options);
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
  options: RuntimeInterpreterOptions,
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
    value: evaluate_text(
      operators,
      expression,
      context,
      options,
      context.word_prefixes,
    ),
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
      context.positional_index += 1;
      context.value_index = Math.max(
        context.value_index,
        context.positional_index,
      );

      return { value: raw_validation_value, next: index + 1 };
    }

    if (context.positional_index >= context.values.length) {
      throw new TypeError(
        "interpreter expression is missing a value for placeholder `" +
          (context.positional_index + 1) + "`",
      );
    }

    const value = context.values[context.positional_index];
    context.positional_index += 1;
    context.value_index = Math.max(
      context.value_index,
      context.positional_index,
    );

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

function read_prefixed_word(
  text: string,
  index: number,
  word_prefixes: readonly string[] = [],
): { readonly value: string; readonly next: number } | undefined {
  for (const prefix of word_prefixes) {
    if (prefix === "" || !text.startsWith(prefix, index)) continue;

    const after_prefix = index + prefix.length;
    const match = /^([A-Za-z_$][A-Za-z0-9_$-]*)/.exec(
      text.slice(after_prefix),
    );

    if (match === null) continue;

    return {
      value: prefix + match[0],
      next: after_prefix + match[0].length,
    };
  }

  return undefined;
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

const sorted_operator_tokens = new WeakMap<
  OperatorRegistry,
  readonly string[]
>();

function operator_tokens(operators: OperatorRegistry): readonly string[] {
  const cached = sorted_operator_tokens.get(operators);

  if (cached !== undefined) {
    return cached;
  }

  const tokens = Object.keys(operators).sort((left, right) => {
    return right.length - left.length;
  });

  sorted_operator_tokens.set(operators, tokens);

  return tokens;
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
  options: RuntimeInterpreterOptions,
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
  options: RuntimeInterpreterOptions,
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
  options: RuntimeInterpreterOptions,
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

type ReferenceScan = {
  has_reference: boolean;
  has_named_reference: boolean;
  /** One past the highest indexed placeholder; anonymous `?` reads here. */
  next_positional_index: number;
};

function scan_references(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
  word_prefixes: readonly string[] = [],
): ReferenceScan {
  const scan: ReferenceScan = {
    has_reference: false,
    has_named_reference: false,
    next_positional_index: 0,
  };

  scan_expression_references(
    operators,
    named_values,
    expression,
    word_prefixes,
    scan,
  );

  return scan;
}

function scan_expression_references(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
  word_prefixes: readonly string[],
  scan: ReferenceScan,
): void {
  let index = 0;
  let expecting_value = true;

  while (index < expression.length) {
    index = skip_whitespace(expression, index);

    if (index >= expression.length) {
      return;
    }

    if (expecting_value) {
      const prefix = read_operator(operators, expression, index, 1, false);

      if (prefix !== undefined) {
        index = prefix.next;
        continue;
      }

      if (expression[index] === "?") {
        index = scan_reference_token(expression, index, scan);
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
        if (typeof named_value.value === "function") {
          index = scan_callable_word_references(
            operators,
            named_values,
            expression,
            index,
            word_prefixes,
            scan,
          );
        }
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
          return;
        }

        scan_expression_references(
          operators,
          named_values,
          expression.slice(index + 1, close),
          word_prefixes,
          scan,
        );
        index = close + 1;
        expecting_value = false;
        continue;
      }

      return;
    }

    const operator = read_operator(operators, expression, index, 2, true);

    if (operator === undefined) {
      return;
    }

    index = operator.next;
    expecting_value = true;
  }
}

function scan_reference_token(
  expression: string,
  index: number,
  scan: ReferenceScan,
): number {
  scan.has_reference = true;

  const name = read_identifier(expression, index + 1);

  if (name !== undefined) {
    scan.has_named_reference = true;

    return name.next;
  }

  const indexed = read_indexed_reference(expression, index + 1);

  if (indexed !== undefined) {
    scan.next_positional_index = Math.max(
      scan.next_positional_index,
      indexed.index + 1,
    );

    return indexed.next;
  }

  return index + 1;
}

function scan_callable_word_references(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
  index: number,
  word_prefixes: readonly string[],
  scan: ReferenceScan,
): number {
  let next = index;

  while (next < expression.length) {
    const word_start = skip_whitespace(expression, next);

    if (word_start === next || word_start >= expression.length) {
      break;
    }

    if (
      read_operator(operators, expression, word_start, 2, true) !== undefined
    ) {
      break;
    }

    const word_next = scan_word_reference(
      operators,
      named_values,
      expression,
      word_start,
      word_prefixes,
      scan,
    );

    if (word_next === undefined) {
      break;
    }

    next = word_next;
  }

  return next;
}

function scan_word_reference(
  operators: OperatorRegistry,
  named_values: ValueRegistry,
  expression: string,
  index: number,
  word_prefixes: readonly string[],
  scan: ReferenceScan,
): number | undefined {
  const prefixed = read_prefixed_word(expression, index, word_prefixes);
  if (prefixed !== undefined) {
    return prefixed.next;
  }

  if (expression[index] === "?") {
    return scan_reference_token(expression, index, scan);
  }

  const literal = read_literal(expression, index);
  if (literal !== undefined) {
    return literal.next;
  }

  const named_value = read_named_value(named_values, expression, index);
  if (named_value !== undefined) {
    return named_value.next;
  }

  const bare = read_identifier(expression, index);
  if (bare !== undefined) {
    return bare.next;
  }

  const operator_value = read_parenthesized_operator_value(
    operators,
    expression,
    index,
  );
  if (operator_value !== undefined) {
    return operator_value.next;
  }

  if (expression[index] !== "(") {
    return undefined;
  }

  const close = find_closing_parenthesis(expression, index);
  if (close === undefined) {
    return undefined;
  }

  scan_expression_references(
    operators,
    named_values,
    expression.slice(index + 1, close),
    word_prefixes,
    scan,
  );

  return close + 1;
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
