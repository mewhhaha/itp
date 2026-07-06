# Changelog

All notable changes to this package will be documented in this file.

## Unreleased

- Added typed operand and result generics to operator definitions.
- Added typed placeholder arguments for literal expressions, indexed
  placeholders, and chains.
- Added type-level checks for known operands in literal expressions.
- Fixed grouped literal subexpressions so parentheses force type-level
  placeholder inference.
- Added validated expression fragments and `raw` tagged-template composition.
- Added feature flag, form validation, and applicative parser example DSLs.
- Hardened named placeholders and operator lookup to ignore inherited prototype
  properties.
- Hardened runtime operator registry validation for malformed definitions and
  empty overload sets.
- Fixed grouped expression parsing when string literals contain parentheses.

## 0.1.0 - 2026-07-05

- Initial release of the typed expression interpreter.
- Added the default `terp` interpreter and helpers for custom operator tables.
- Added interpreter-level named values for DSL constants and functions.
- Added standard numeric, equality, ordering, and boolean operators.
