import {
  type BinaryOperatorDefinition,
  type InfixDirection,
  interpreter,
  operators,
  type UnaryOperatorDefinition,
} from "../mod.ts";

type Guard<value> = (value: unknown) => value is value;
type UnaryFunction = (value: unknown) => unknown;
type Point = { x: number; y: number };

const anything: Guard<unknown> = (_value): _value is unknown => true;

const unary_function: Guard<UnaryFunction> = (
  value,
): value is UnaryFunction => {
  return typeof value === "function";
};

const point: Guard<Point> = (value): value is Point => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Point>;

  return typeof candidate.x === "number" && typeof candidate.y === "number";
};

const functions = interpreter(operators({
  then: checked_binary(
    "pipe",
    1,
    "left",
    anything,
    unary_function,
    (value, fn) => fn(value),
  ),
  near: checked_binary(
    "geometry",
    4,
    "none",
    point,
    point,
    (left, right) => Math.hypot(left.x - right.x, left.y - right.y) <= 10,
  ),
  quadrant: checked_unary("geometry", 8, point, (value) => {
    return value.x >= 0 && value.y >= 0 ? "NE" : "other";
  }),
}));

const trim = (value: unknown) => String(value).trim();
const shout = (value: unknown) => String(value).toUpperCase() + "!";

console.log("functions", {
  pipeline: functions("? then ? then ?", " hello ", trim, shout),
  near: functions("?from near ?to", {
    from: { x: 0, y: 0 },
    to: { x: 3, y: 4 },
  }),
  quadrant: functions("quadrant ?point", { point: { x: 3, y: 4 } }),
});

function checked_binary<const kind extends string, left, right, result>(
  kind: kind,
  precedence: number,
  direction: InfixDirection,
  left_guard: Guard<left>,
  right_guard: Guard<right>,
  fn: (left: left, right: right) => result,
): BinaryOperatorDefinition<kind> {
  return {
    kind,
    precedence,
    direction,
    arity: 2,
    apply(left, right) {
      if (!left_guard(left) || !right_guard(right)) {
        throw new TypeError("operator `" + kind + "` rejected an operand");
      }

      return fn(left, right);
    },
  };
}

function checked_unary<const kind extends string, value, result>(
  kind: kind,
  precedence: number,
  guard: Guard<value>,
  fn: (value: value) => result,
): UnaryOperatorDefinition<kind> {
  return {
    kind,
    precedence,
    arity: 1,
    apply(value) {
      if (!guard(value)) {
        throw new TypeError("operator `" + kind + "` rejected an operand");
      }

      return fn(value);
    },
  };
}
