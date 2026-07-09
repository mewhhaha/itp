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
  grep: unary_operator("shell", 8, (needle) => grep(as_string(needle))),
  "|": pipe_operator(),
}, {
  values: {
    basename,
    count,
    first: head(1),
    greeting: "  hello from terp  ",
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
const greetings = [
  "hello from terp",
  "goodbye for now",
  "well hello again",
].join("\n");

const user_pipeline = shell.raw('? | lines | grep "error" | count');

if (user_pipeline instanceof Error) {
  console.error(user_pipeline.summary);
  throw user_pipeline;
}

console.log("bash-like", {
  greeting: shell("echo greeting | trim | upper"),
  hello_lines: shell('echo ? | grep "hello" | join_comma', greetings),
  first_error: shell('? | lines | grep "error" | first | join_comma', log),
  error_count: user_pipeline(log),
  home_name: shell('env "HOME" | basename'),
});

// New: functions in `values` support direct space-separated calls and
// shell-style flags. With flags present they receive a CommandInvocation
// record; without flags they are called directly with the arguments.
const cli_grep = (inv: import("../mod.ts").CommandInvocation) => {
  const needle = String(inv.positionals[0] ?? "");
  const ignore_case = !!inv.flags.i || !!inv.flags["ignore-case"];
  return (input: unknown) =>
    as_lines(input).filter((line) =>
      ignore_case ? line.toLowerCase().includes(needle.toLowerCase()) : line.includes(needle),
    );
};

const shell_direct = interpreter({ "|": pipe_operator() }, {
  values: {
    ...shell.values,
    grepcase: cli_grep,
  },
});
console.log("shell-direct", {
  with_flag: shell_direct('? | grepcase -i "hello" | join_comma', greetings),
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
