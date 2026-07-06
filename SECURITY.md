# Security

Report security issues privately to the package maintainer before opening a
public issue. Include the affected version, a minimal reproduction, and the
expected impact.

This package evaluates strings against operator tables supplied by the caller.
Do not expose untrusted operator implementations or privileged `apply_operator`
hooks to arbitrary user input.

Expression strings are parsed as DSL text, not JavaScript. Named placeholders
read only own properties from the supplied scope object, but any registered
operator, named value, or `apply_operator` hook can still run arbitrary
application code when an expression is executed.
