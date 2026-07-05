# Contributing

## Development

Run the local validation suite before opening a pull request:

```sh
deno task ci
```

Useful individual commands:

```sh
deno task fmt
deno task lint
deno task doc:lint
deno task check
deno task test
deno task publish:dry-run
```

## Release Checklist

1. Update `CHANGELOG.md`.
2. Bump `version` in `deno.json`.
3. Run `deno task ci`.
4. Commit the release changes and publish with `deno publish`.
