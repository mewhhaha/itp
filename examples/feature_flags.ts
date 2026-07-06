import {
  type BinaryOperatorDefinition,
  boolean_operator,
  boolean_unary_operator,
  equality_operator,
  interpreter,
} from "../mod.ts";

type Flag = {
  readonly key: string;
  readonly rule: string;
};

type UserContext = {
  readonly user_id: string;
  readonly country: string;
  readonly plan: string;
  readonly employee: boolean;
  readonly enabled_countries: readonly string[];
  readonly rollout: number;
  readonly tags: readonly string[];
};

const flags = [
  {
    key: "new_checkout",
    rule: '(?country in ?enabled_countries and ?plan is "pro") or ?employee',
  },
  {
    key: "search_v2",
    rule: "?user_id rollout ?rollout and not ?employee",
  },
  {
    key: "beta_reports",
    rule: '?tags has "reports" and ?plan is "enterprise"',
  },
] satisfies readonly Flag[];

const feature_flags = interpreter({
  and: boolean_operator(3, "right", (left, right) => left && right),
  or: boolean_operator(2, "right", (left, right) => left || right),
  not: boolean_unary_operator(5, (value) => !value),
  is: equality_operator(),
  in: membership_operator(),
  has: contains_operator(),
  rollout: rollout_operator(),
});

const users = [
  {
    user_id: "usr_1001",
    country: "US",
    plan: "pro",
    employee: false,
    enabled_countries: ["US", "CA", "NL"],
    rollout: 50,
    tags: ["reports"],
  },
  {
    user_id: "usr_1002",
    country: "DE",
    plan: "free",
    employee: true,
    enabled_countries: ["US", "CA", "NL"],
    rollout: 50,
    tags: [],
  },
  {
    user_id: "usr_1003",
    country: "NL",
    plan: "enterprise",
    employee: false,
    enabled_countries: ["US", "CA", "NL"],
    rollout: 50,
    tags: ["reports", "early-access"],
  },
] satisfies readonly UserContext[];

const report = users.map((user) => {
  return {
    user: user.user_id,
    flags: Object.fromEntries(
      flags.map((flag) => [flag.key, evaluate_flag(flag, user)]),
    ),
  };
});

console.log("feature-flags", report);

function evaluate_flag(flag: Flag, user: UserContext): boolean {
  const value = feature_flags(flag.rule, user);

  if (typeof value !== "boolean") {
    throw new TypeError("flag `" + flag.key + "` did not return a boolean");
  }

  return value;
}

function membership_operator(): BinaryOperatorDefinition<
  "membership",
  unknown,
  readonly unknown[],
  boolean
> {
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

function contains_operator(): BinaryOperatorDefinition<
  "membership",
  readonly unknown[],
  unknown,
  boolean
> {
  return {
    kind: "membership",
    precedence: 4,
    direction: "none",
    arity: 2,
    apply(left, right) {
      if (!Array.isArray(left)) {
        throw new TypeError("contains operator expected an array");
      }

      return left.includes(right);
    },
  };
}

function rollout_operator(): BinaryOperatorDefinition<
  "rollout",
  string,
  number,
  boolean
> {
  return {
    kind: "rollout",
    precedence: 4,
    direction: "none",
    arity: 2,
    apply(left, right) {
      if (typeof left !== "string" || typeof right !== "number") {
        throw new TypeError("rollout operator expected user id and percent");
      }

      return bucket(left) < right;
    },
  };
}

function bucket(value: string): number {
  let hash = 0x811C9DC5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0) % 100;
}
