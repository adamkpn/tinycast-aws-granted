# Granted

Open the AWS Console signed in with any of your AWS profiles, through [Granted](https://granted.dev)'s `assume -c`. Pick a profile, a region and a service; Granted signs you in and opens the console in your browser.

> Unofficial extension. Not affiliated with Granted, Common Fate, fwd:cloudsec or Amazon Web Services.

## Features

- Ranked search over the profiles in your AWS `config` and `credentials` files: best match first, separators ignored, account IDs searchable
- 60 console services with their official AWS names and icons, plus the console home
- All launched commercial, GovCloud and China regions
- Recent profiles and services listed first
- Account ID and profile region shown on each profile
- Copy the profile name or the exact `assume` command

## Setup

1. Install Granted:

   ```bash
   brew tap fwdcloudsec/granted
   brew install granted
   ```

2. Follow Granted's [Getting Started](https://docs.granted.dev/getting-started/) guide until `assume -c <profile>` opens the console from a terminal. For AWS IAM Identity Center (SSO), `granted sso populate` adds every account and role to your AWS config.
3. Run **Open AWS Console**. If your AWS files aren't in `~/.aws`, set **AWS Folder** in the extension preferences.

## Usage

1. Search for a profile and press ↵.
2. Pick a region. ↵ keeps the one listed first: the profile's region or your default.
3. Pick a service, or press ⌘↵ to open the console home.

| Where | Key | Action |
|---|---|---|
| Profile | ↵ | Choose a region, then a service |
| Profile | ⌘↵ | Open the console home |
| Profile | ⌥↵ | Skip the region and choose a service |
| Profile | ⌘⌥C | Copy the profile name |
| Profile, service | ⌘⇧C | Copy the `assume` command |
| Service | ↵ | Open the service |
| Service | ⌘↵ | Open the console home |
| Service | ⌥↵ | Change region |
| Region | ↵ | Select the region |
| Region | ⌘↵ | Open the console home in that region |

### Search

Results are ranked, best match first: an exact name beats a prefix, a prefix beats a whole word, and so on down to loose letter-by-letter matches. Separators don't matter (`acme-io` finds `acmeio`), and every word must match: `io admin` finds the `AdministratorAccess` role of `acmeio`. Profiles match on name, account alias (the part before the first `.`), account ID and region; services on their `-s` value, name and keywords. On equal scores, recent items come first.

## Preferences

| Preference | Default | What it does |
|---|---|---|
| Default Region | `us-east-2` | Region used when you don't pick one. Invalid values fall back to `us-east-2`. |
| Profile Region | off | Use the profile's own `region` instead of the default region. |
| AWS Folder | `~/.aws` | Folder with your `config` and `credentials` files. `AWS_CONFIG_FILE` and `AWS_SHARED_CREDENTIALS_FILE` still take precedence when the launcher passes them. `assume` gets the same files. |
| AWS CLI Profiles | off | Also run `aws configure list-profiles`. Only needed for profiles missing from the config files; it starts the AWS CLI on every open. |
| Path to Assume | auto | Absolute path to Granted's `assume`. Empty means search `/opt/homebrew/bin`, `/usr/local/bin`, then `PATH`. Only point it at a binary you trust. |

## How This Differs from Amazon AWS

The [Amazon AWS](https://github.com/raycast/extensions/tree/main/extensions/amazon-aws) extension browses resources through the AWS SDK and links to the console. This extension does one thing: open the console **signed in** as the profile you pick.

| | Granted | Amazon AWS |
|---|---|---|
| Console link | Signed in as the chosen profile and role (`assume -c`) | Plain console URL in your current browser session |
| Several accounts at once | One browser session per profile, through Granted | One session, whichever you're signed in to |
| Credentials | Handled by Granted | AWS SDK, aws-vault or aws-sso |

## Troubleshooting

**"Granted `assume` not found".** Install Granted, or set **Path to Assume** to the output of `which assume`.

**"No AWS profiles found".** The empty view shows which config and credentials files were read. Check that they exist and contain `[profile name]` (config) or `[name]` (credentials) sections, or set **AWS Folder**.

**"assume failed".** The toast shows the last lines of Granted's error. Copy the `assume` command (⌘⇧C) and run it in a terminal to see the full output. Granted can't ask questions here, so answer any prompt (browser choice, MFA) once in a terminal.

## Install in Tinycast

The extension also runs in [Tinycast](https://github.com/abue-ammar/tinycast):

- **From GitHub:** Settings → Extensions → Install New → **Install from GitHub**, then enter `https://github.com/adamkpn/tinycast-aws-granted`.
- **From a release:** download `granted-v*.zip` from [Releases](https://github.com/adamkpn/tinycast-aws-granted/releases), check it with `shasum -a 256 -c granted-v*.zip.sha256`, unzip it, then **Add from folder** and pick the `granted` folder.

## Privacy

The extension reads profile names, account IDs and regions from your AWS config files, never credentials, and makes no network requests. It stores only your recent profile names and service IDs. Signing in is done by Granted.

## Credits

- [Granted](https://granted.dev) by Common Fate and fwd:cloudsec. The icon uses the Granted logo from the [Granted repository](https://github.com/fwdcloudsec/granted) (MIT).
- Service icons from the [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) package. AWS and the service names are trademarks of Amazon.com, Inc. or its affiliates.
- Ported from [alfred-aws-granted](https://github.com/adamkpn/alfred-aws-granted), inspired by [sherifabdlnaby/alfred-aws-granted](https://github.com/sherifabdlnaby/alfred-aws-granted).

Development, releases and the Store process are in [CONTRIBUTING.md](CONTRIBUTING.md). MIT license.
