# Changelog

All notable changes to this package will be documented in this file.

## Unreleased

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
