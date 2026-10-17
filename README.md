# AWS Granted for Tinycast

Open the AWS Console from [Tinycast](https://github.com/abue-ammar/tinycast) (or Raycast) through [Granted](https://granted.dev). Pick a profile, a region and a service, and the extension runs `assume -c` for you.

This is a port of [alfred-aws-granted](https://github.com/adamkpn/alfred-aws-granted). It has the same profiles, services and regions. The one difference: it asks for the region after the profile.

## Features

- Search AWS profiles from `~/.aws/config`, `~/.aws/credentials` and, optionally, `aws configure list-profiles`
- 60 console services with their official AWS names and icons, plus the console home
- All launched commercial, GovCloud and China regions
- Recent profiles and services listed first
- Account ID (`sso_account_id` / `granted_sso_account_id`) and profile region shown on each profile
- Copy the profile name or the exact `assume` command

### Key bindings

| Where | Key | Action |
|---|---|---|
| Profile | **↵** | Choose a region, then a service |
| Profile | **⌘ ↵** | Open the console home |
| Profile | **⌥ ↵** | Skip the region and choose a service |
| Profile | **⌘ ⇧ Period** | Copy the profile name |
| Profile, service | **⌘ ⇧ C** | Copy the `assume` command |
| Service | **↵** | Open the service |
| Service | **⌘ ↵** | Open the console home |
| Service | **⌥ ↵** | Change region |
| Region | **↵** | Select region (the current one is listed first) |
| Region | **⌘ ↵** | Open the console home in that region |

## Prerequisites

1. macOS with [Tinycast](https://github.com/abue-ammar/tinycast) or [Raycast](https://raycast.com).
2. Granted installed and configured:

   ```bash
   brew tap fwdcloudsec/granted
   brew install granted
   ```

3. Follow Granted's [Getting Started](https://docs.granted.dev/getting-started/) guide so `assume <profile>` works in a terminal.

## Installation

### Tinycast

**From GitHub:** Settings → Extensions → Install New → **Install from GitHub**, then enter `https://github.com/adamkpn/tinycast-aws-granted`. Tinycast builds it locally.

**From a release:** download `aws-granted-v*.zip` from [Releases](https://github.com/adamkpn/tinycast-aws-granted/releases), unzip it, then Settings → Extensions → Install New → **Add from folder** and pick the `aws-granted` folder. Each zip has a `.sha256` file next to it:

```bash
shasum -a 256 -c aws-granted-v1.0.0.zip.sha256
```

**From source** (Node.js 22+): run `make build-dist`, then **Add from folder** and pick `dist/`. Run it again after pulling changes; Tinycast copies the folder instead of linking to it.

### Raycast

The extension is not in the Raycast Store. Install it from source (Node.js 22+):

```bash
git clone https://github.com/adamkpn/tinycast-aws-granted && cd tinycast-aws-granted
make install
make dev
```

`make dev` loads the extension into Raycast. It stays installed after you stop the dev server.

## Usage

1. Open Tinycast (or Raycast) and run **Open AWS Console**.
2. Search for a profile and press ↵.
3. Pick a region (↵ keeps the one listed first).
4. Pick a service, or press ⌘ ↵ to go straight to the console home.

## Preferences

| Preference | Default | What it does |
|---|---|---|
| Default Region | `us-east-2` | Region used when you don't pick one. Invalid values fall back to `us-east-2`. |
| Profile Region | off | Use the profile's own `region` from `~/.aws/config` instead of the default. |
| AWS CLI Profiles | on | Also run `aws configure list-profiles`. Slower; the config files are always read. |
| Path to assume | auto | Absolute path to the `assume` binary. Empty means search `/opt/homebrew/bin`, `/usr/local/bin`, then `PATH`. |

`AWS_CONFIG_FILE` and `AWS_SHARED_CREDENTIALS_FILE` are respected.

## Troubleshooting

**"Granted `assume` not found".** Install Granted, or set **Path to assume** to the output of `which assume`.

**"No AWS profiles found".** The empty view shows the config and credentials paths that were read. Check that they exist and contain `[profile name]` (config) or `[name]` (credentials) sections.

**"assume failed".** The toast shows the last lines of Granted's error. Run the copied `assume` command in a terminal to see the full output.

## Development

Run `make` to list every target. The common ones:

```bash
make verify     # build, typecheck, ray lint, tests
make test       # unit tests for src/lib
make security   # npm audit, Trivy filesystem scan, Gitleaks (Docker required for the last two)
make publish    # open a PR to raycast/extensions
```

`make lint` runs `ray lint`, which also checks that the `author` in `package.json` is a Raycast Store user. The release workflow runs ESLint and Prettier directly instead.

```
src/open-console.tsx   # the command: profile, service and region lists
src/lib/granted.ts     # builds and runs `assume -c`
src/lib/profiles.ts    # reads ~/.aws/config, ~/.aws/credentials and the AWS CLI
src/lib/services.ts    # console services and their `-s` values
src/lib/regions.ts     # regions and validation
src/lib/recent.ts      # recent profiles and services (LocalStorage)
src/lib/env.ts         # PATH, HOME and binary lookup
.github/workflows/     # release on version tags
assets/                # extension, profile, region and service icons
```

## Security

- `assume` and `aws` run through `execFile` with an argument list. No shell is involved.
- Profile names starting with `-` are skipped so they can't be read by `assume` as flags. Regions are checked against the AWS region format.
- Relative `PATH` entries are ignored when looking up `assume` and `aws`.
- The extension never reads credentials. LocalStorage holds only recent profile names and service IDs.
- **Path to assume** runs whatever binary you point it at. Only set it to a binary you trust.

## Releasing

Add a `## [x.y.z]` section to `CHANGELOG.md`, then push a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The release workflow checks, builds and tests the extension, then publishes a GitHub Release with the zip, its SHA-256 checksum and the changelog section as notes.

## Updating services and regions

`src/lib/services.ts` and `src/lib/regions.ts` list their sources at the top: Granted's service map for the `-s` values, the [AWS Regional Services table](https://api.regional-table.region-services.aws.a2z.com/index.json) for names and regions, and the [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) package for icons. `make test` fails if an icon is missing or unused.

## License

MIT for the code. The service icons come from the AWS Architecture Icons package; AWS and the service names are trademarks of Amazon.com, Inc. or its affiliates.

## Credits

- [Granted](https://granted.dev) by fwd:cloudsec
- [alfred-aws-granted](https://github.com/sherifabdlnaby/alfred-aws-granted) by Sherif Abdel-Naby, the original Alfred workflow
- [Raycast API](https://developers.raycast.com)
