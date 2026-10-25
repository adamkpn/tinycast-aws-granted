# Contributing

## Development

Needs Node.js 22.22.2 or later. Run `make` to list every target. The common ones:

```bash
make install    # npm ci
make dev        # load into Raycast with hot reload
make verify     # build, typecheck, ray lint, tests
make security   # npm audit, Trivy filesystem scan, Gitleaks (Docker for the last two)
```

`make lint` runs `ray lint`, which also checks that `author` in `package.json` is a Raycast user. The release workflow runs ESLint and Prettier directly instead.

```
src/open-console.tsx   # the command: profile, region and service lists
src/lib/granted.ts     # builds and runs `assume -c`
src/lib/profiles.ts    # reads the AWS config and credentials files, and the AWS CLI
src/lib/search.ts      # ranked search
src/lib/services.ts    # console services and their `-s` values
src/lib/regions.ts     # regions and validation
src/lib/recent.ts      # recent profiles and services (LocalStorage)
src/lib/env.ts         # PATH, HOME, AWS file locations and binary lookup
assets/                # extension, profile, region and service icons
```

Tests use made-up profile names only (`acme…`). The repository is public: never commit real profile names or account IDs.

## Security notes

- `assume` and `aws` run through `execFile` with an argument list. No shell is involved, and search text is never passed to a process.
- Profile names starting with `-` are skipped so `assume` can't read them as flags. Regions are checked against the AWS region format.
- Relative `PATH` entries are ignored when looking up `assume` and `aws`.
- `assume` runs with stdin closed: a Granted prompt fails at once instead of hanging until the 180 s timeout.

## Updating services, regions and the icon

- `src/lib/services.ts` and `src/lib/regions.ts` list their sources at the top: Granted's service map for the `-s` values, the [AWS Regional Services table](https://api.regional-table.region-services.aws.a2z.com/index.json) for names and regions, and the [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) package for icons. `make test` fails if an icon is missing or unused.
- `make icon` renders `assets/icon.png` (512x512) from the Granted logo, pinned by commit and SHA-256 (`ICON_SVG_URL`, `ICON_SVG_SHA256`). To use a different glyph, override both variables.

## Releasing on GitHub

Add a `## [x.y.z]` section to `CHANGELOG.md`, merge to `main`, pull, then tag the merged commit:

```bash
git switch main && git pull --ff-only
git tag vX.Y.Z && git push origin vX.Y.Z
```

The release workflow builds and tests the extension, then publishes the zip, its SHA-256 checksum and the changelog section as release notes. It fails if the tagged commit has no matching changelog section.

## Publishing to the Raycast Store

Follow [Prepare an extension for Store](https://developers.raycast.com/basics/prepare-an-extension-for-store) and [Publish an extension](https://developers.raycast.com/basics/publish-an-extension). For this repository:

1. **Account.** `author` is `adamkpn`, which must be a Raycast username (raycast.com, sign in with GitHub).
2. **Changelog.** New entries use `## [x.y.z] - {PR_MERGE_DATE}`; Raycast fills in the date on merge.
3. **Screenshots.** Up to six 2000x1250 PNGs in `metadata/`, taken with Raycast's Window Capture ("Save to Metadata"). Use demo data, never real accounts: `make demo-config`, set **AWS Folder** to `/tmp/granted-demo`, take the screenshots, then clear the preference.
4. **Publish.** `make publish`. It removes `dist/` (`ray publish` copies the folder without reading `.gitignore`), refuses to run with uncommitted changes, and turns off commit signing for the commits it makes in its `raycast/extensions` fork. When GitHub asks, authorize the account that should own the pull request.
5. **Review.** Answer review comments, then run `make publish` again to update the pull request. If someone edits the extension in `raycast/extensions`, run `npx @raycast/api@latest pull-contributions` first.

Raycast's [extension guidelines](https://manual.raycast.com/extensions-guidelines) reject extensions that provide "very similar value" to an existing one. The closest is [Amazon AWS](https://github.com/raycast/extensions/tree/main/extensions/amazon-aws), which links to the console but doesn't sign in; the README explains the difference. If reviewers ask for this to live inside Amazon AWS instead, `src/lib/` (granted, profiles, services, regions, search) has no UI dependencies and can move there as a "Console (Signed In with Granted)" command, while this repository keeps shipping the standalone extension for Tinycast.
