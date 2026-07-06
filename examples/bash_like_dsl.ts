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
}, {
  values: {
    basename,
    count,
    first: head(1),
    greeting: "  hello from terp  ",
    grep_error: grep("error"),
    join_comma: join(", "),
    lines,
    trim,
    upper,
  },
});

const log = [
  "info boot",
  "warn disk",
  "error database",
  "info ready",
  "error cache",
].join("\n");

const user_pipeline = shell.raw("? | lines | grep_error | count");

if (user_pipeline instanceof Error) {
  console.error(user_pipeline.summary);
  throw user_pipeline;
}

console.log("bash-like", {
  greeting: shell("echo greeting | trim | upper"),
  first_error: shell("? | lines | grep_error | first | join_comma", log),
  error_count: user_pipeline(log),
  home_name: shell('env "HOME" | basename'),
});

function pipe_operator(): BinaryOperatorDefinition<
  "shell",
  unknown,
  Command,
  unknown
> {
  return {
    kind: "shell",
    precedence: 1,
    direction: "left",
    arity: 2,
    apply(input, command) {
      if (!is_command(command)) {
        throw new TypeError("expected a command function");
      }

      return command(input);
    },
  };
}

function is_command(value: unknown): value is Command {
  return typeof value === "function";
}

function as_string(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  throw new TypeError("expected a string");
}

function trim(input: unknown): string {
  return as_string(input).trim();
}

function upper(input: unknown): string {
  return as_string(input).toUpperCase();
}

function lines(input: unknown): readonly string[] {
  return as_string(input).split(/\r?\n/).filter((line) => {
    return line.length > 0;
  });
}

function grep(needle: string): Command {
  return (input) =>
    as_lines(input).filter((line) => {
      return line.includes(needle);
    });
}

function head(size: number): Command {
  return (input) => as_lines(input).slice(0, size);
}

function count(input: unknown): number {
  return as_lines(input).length;
}

function join(separator: string): Command {
  return (input) => as_lines(input).join(separator);
}

function basename(input: unknown): string {
  const parts = as_string(input).split("/");

  return parts[parts.length - 1] ?? "";
}

function as_lines(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map(as_string);
  }

  return as_string(value).split(/\r?\n/).filter((line) => {
    return line.length > 0;
  });
}
