import { type BinaryOperatorDefinition, interpreter } from "../mod.ts";

type Validation = {
  readonly valid: boolean;
  readonly errors: readonly string[];
};

type Validator = (value: unknown) => Validation;

type SignupForm = {
  readonly email: string;
  readonly password: string;
  readonly age: number;
  readonly referral_code: string;
};

const form = interpreter({
  passes: passes_operator(),
  and: combine_operator(),
  or: either_operator(),
}, {
  values: {
    required_email: required("email"),
    email_shape: matches(
      "email has an invalid format",
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
    ),
    strong_password: strong_password(),
    adult: minimum_number("age", 18),
    blank_referral: matches("referral_code must be blank", /^$/),
    referral_shape: matches(
      "referral_code must look like ABC-1234",
      /^[A-Z]{3}-\d{4}$/,
    ),
  },
});

const signup_rule = form.raw(
  "?email passes required_email and " +
    "?email passes email_shape and " +
    "?password passes strong_password and " +
    "?age passes adult and " +
    "(?referral_code passes blank_referral or " +
    "?referral_code passes referral_shape)",
);

if (signup_rule instanceof Error) {
  throw signup_rule;
}

const submissions = [
  {
    email: "ada@example.com",
    password: "trenchcoat42",
    age: 37,
    referral_code: "",
  },
  {
    email: "not-an-email",
    password: "short",
    age: 16,
    referral_code: "friend",
  },
  {
    email: "grace@example.com",
    password: "compiler-1952",
    age: 22,
    referral_code: "OSS-1952",
  },
] satisfies readonly SignupForm[];

console.log(
  "form-validation",
  submissions.map((submission, index) => {
    const result = signup_rule(submission);

    return {
      submission: index + 1,
      valid: as_validation(result).valid,
      errors: as_validation(result).errors,
    };
  }),
);

function passes_operator(): BinaryOperatorDefinition<
  "validation",
  unknown,
  Validator,
  Validation
> {
  return {
    kind: "validation",
    precedence: 4,
    direction: "none",
    arity: 2,
    apply(left, right) {
      if (typeof right !== "function") {
        throw new TypeError("passes expected a validator");
      }

      return right(left);
    },
  };
}

function combine_operator(): BinaryOperatorDefinition<
  "validation",
  Validation,
  Validation,
  Validation
> {
  return {
    kind: "validation",
    precedence: 3,
    direction: "right",
    arity: 2,
    apply(left, right) {
      return combine(as_validation(left), as_validation(right));
    },
  };
}

function either_operator(): BinaryOperatorDefinition<
  "validation",
  Validation,
  Validation,
  Validation
> {
  return {
    kind: "validation",
    precedence: 2,
    direction: "right",
    arity: 2,
    apply(left, right) {
      const left_validation = as_validation(left);
      const right_validation = as_validation(right);

      if (left_validation.valid || right_validation.valid) {
        return ok();
      }

      return fail([...left_validation.errors, ...right_validation.errors]);
    },
  };
}

function required(field: string): Validator {
  return (value) => {
    return value === undefined || value === null || value === ""
      ? fail([field + " is required"])
      : ok();
  };
}

function matches(message: string, pattern: RegExp): Validator {
  return (value) => {
    return typeof value === "string" && pattern.test(value)
      ? ok()
      : fail([message]);
  };
}

function minimum_number(field: string, minimum: number): Validator {
  return (value) => {
    return typeof value === "number" && value >= minimum
      ? ok()
      : fail([field + " must be at least " + String(minimum)]);
  };
}

function strong_password(): Validator {
  return (value) => {
    if (typeof value !== "string") {
      return fail(["password must be a string"]);
    }

    if (value.length < 10 || !/\d/.test(value)) {
      return fail(["password must be at least 10 characters with a digit"]);
    }

    return ok();
  };
}

function combine(left: Validation, right: Validation): Validation {
  return {
    valid: left.valid && right.valid,
    errors: [...left.errors, ...right.errors],
  };
}

function ok(): Validation {
  return { valid: true, errors: [] };
}

function fail(errors: readonly string[]): Validation {
  return { valid: false, errors };
}

function as_validation(value: unknown): Validation {
  if (is_validation(value)) {
    return value;
  }

  throw new TypeError("expected validation result");
}

function is_validation(value: unknown): value is Validation {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Validation>;

  return typeof candidate.valid === "boolean" &&
    Array.isArray(candidate.errors);
}
