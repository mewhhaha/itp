import {
  type BinaryOperatorDefinition,
  boolean_operator,
  boolean_unary_operator,
  equality_operator,
  interpreter,
  operators,
  ordering_operator,
} from "../mod.ts";

const rules = interpreter(operators({
  above: ordering_operator((left, right) => left > right),
  at_least: ordering_operator((left, right) => left >= right),
  below: ordering_operator((left, right) => left < right),
  is: equality_operator(),
  in: membership_operator(),
  and: boolean_operator(3, "right", (left, right) => left && right),
  or: boolean_operator(2, "right", (left, right) => left || right),
  not: boolean_unary_operator(5, (value) => !value),
}));

const approve_enterprise_order = rules(
  "?amount above 10000 and ?country in ?allowed_countries and not ?manual_hold",
);
const request_review = rules(
  "?amount at_least 50000 or (?risk below 0.35) is false",
);

const order = {
  amount: 42_000,
  country: "US",
  allowed_countries: ["US", "CA", "NL"],
  manual_hold: false,
  risk: 0.28,
};

console.log("rules", {
  approved: approve_enterprise_order(order),
  review: request_review(order),
});

function membership_operator(): BinaryOperatorDefinition<"membership"> {
  return {
    kind: "membership",
    precedence: 4,
    direction: "none",
    arity: 2,
    apply(left, right) {
      if (!Array.isArray(right)) {
        throw new TypeError("membership operator expected an array");
      }

      return right.includes(left);
    },
  };
}
