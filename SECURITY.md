# Security

Report security issues privately to the package maintainer before opening a
public issue. Include the affected version, a minimal reproduction, and the
expected impact.

This package evaluates strings against operator tables supplied by the caller.
Do not expose untrusted operator implementations or privileged `apply_operator`
hooks to arbitrary user input.
