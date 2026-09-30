# Contributing

## Development

Requires Node.js ^22.18.0 || ^24.11.0 || >=26.0.0 and Bun 1.4.2 (the `packageManager` field is authoritative).

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
