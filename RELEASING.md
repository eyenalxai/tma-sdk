# Releasing

Releases are manual for now.

## Before releasing

1. Use a clean working tree on `main`.
2. Ensure every user-facing change has a changeset.
3. Run the complete local gate:

   ```sh
   bun install --frozen-lockfile
   bun run check
   ```

4. Review the package contents:

   ```sh
   npm pack --dry-run
   ```

## Version and publish

1. Consume changesets and review `CHANGELOG.md`:

   ```sh
   bun run version-packages
   ```

2. Commit the version and changelog changes.
3. Authenticate to npm with an account that can publish to `@eyenalxai`.
4. Publish the checked package:

   ```sh
   npm publish --access public
   ```

   `prepublishOnly` runs the full local gate before npm publishes.

5. Verify the published package in a clean temporary directory.
6. Create and push the matching `vX.Y.Z` Git tag.
7. Create the GitHub release from the changelog entry.

Do not use a long-lived npm token in this repository. A later automation change should use npm trusted publishing with GitHub Actions OIDC and automatic provenance.
