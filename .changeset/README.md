# Release notes

Add a changeset for every publishable package change with `pnpm changeset`. Website-only changes do not need a package version bump.

For the current maintenance change, the pending patch targets 2.2.2 from 2.2.1. It is not published until the release steps complete.

1. Run `pnpm changeset:status` to review pending updates.
2. Run `pnpm version:packages` once to update versions and generate package changelogs, then run `pnpm install --lockfile-only --ignore-scripts` and commit the version files.
3. Run `pnpm test:core` and `pnpm build:core`, review the package contents, and release from a clean checkout with `pnpm release:publish`.

The publish command uses the package-level `.release-it.changesets.json` configuration with `--no-increment`: Changesets owns the version bump and changelog. Do not run the older incremental `release:patch`, `release:minor`, or `release:major` commands after Changesets has versioned a release. This configuration omits the conventional-changelog plugin to avoid regenerating the Changesets changelog. Release-it remains responsible for publishing, the release commit/tag, and GitHub release. The command requires the maintainer's registry and GitHub credentials.
