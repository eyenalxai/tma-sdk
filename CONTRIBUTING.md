# Contributing

## Development

Requires Node.js >= 20.19.0 and Bun 1.3.11 (the `packageManager` field is authoritative).

```sh
bun install
bun run check
```

The repository intentionally has no CI configuration yet. Local checks are the current quality gate.

## Changes

Use a changeset for changes that should appear in the changelog:

```sh
bunx changeset
```

Use conventional, focused commits. Do not bump the package version directly; Changesets owns release versioning.

## Security

Do not include bot tokens, Telegram init data from real users, credentials, or other private data in commits, tests, issues, or examples.
