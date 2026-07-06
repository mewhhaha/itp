import {
  type BinaryOperatorDefinition,
  interpreter,
  unary_operator,
} from "../mod.ts";

type Command = (input: unknown) => unknown;

const environment = {
  HOME: "/home/terp",
  USER: "terp",
};

const shell = interpreter({
  echo: unary_operator("shell", 8, as_string),
  env: unary_operator("shell", 8, (name) => {
    const key = as_string(name);
    const value = environment[key as keyof typeof environment];

    if (value === undefined) {
      throw new TypeError("unknown environment key `" + key + "`");
    }

    return value;
  }),
  "|": pipe_operator(),
});

const log = [
  "info boot",
  "warn disk",
  "error database",
  "info ready",
  "error cache",
].join("\n");

const user_pipeline = shell.raw("? | 'lines' | 'grep:error' | 'count'");

if (user_pipeline instanceof Error) {
  console.error(user_pipeline.summary);
  throw user_pipeline;
}

console.log("bash-like", {
  greeting: shell('echo "  hello from terp  " | "trim" | "upper"'),
  first_error: shell("? | 'lines' | 'grep:error' | 'head:1' | 'join:, '", log),
  error_count: user_pipeline(log),
  home_name: shell('env "HOME" | "basename"'),
});

function pipe_operator(): BinaryOperatorDefinition<"shell"> {
  return {
    kind: "shell",
    precedence: 1,
    direction: "left",
    arity: 2,
    apply(input, command) {
      return command_from(command)(input);
    },
  };
}

function command_from(command: unknown): Command {
  const spec = as_string(command);
  const separator = spec.indexOf(":");
  const name = separator === -1 ? spec : spec.slice(0, separator);
  const argument = separator === -1 ? "" : spec.slice(separator + 1);

  switch (name) {
    case "trim":
      return (input) => as_string(input).trim();
    case "upper":
      return (input) => as_string(input).toUpperCase();
    case "lines":
      return (input) =>
        as_string(input).split(/\r?\n/).filter((line) => {
          return line.length > 0;
        });
    case "grep":
      return (input) =>
        as_lines(input).filter((line) => {
          return line.includes(argument);
        });
    case "head":
      return (input) => as_lines(input).slice(0, Number(argument));
    case "count":
      return (input) => as_lines(input).length;
    case "join":
      return (input) => as_lines(input).join(argument || "\n");
    case "basename":
      return (input) => {
        const parts = as_string(input).split("/");

        return parts[parts.length - 1] ?? "";
      };
    default:
      throw new TypeError("unknown command `" + name + "`");
  }
}

function as_string(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  throw new TypeError("expected a string");
}

function as_lines(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map(as_string);
  }

  return as_string(value).split(/\r?\n/).filter((line) => {
    return line.length > 0;
  });
}
