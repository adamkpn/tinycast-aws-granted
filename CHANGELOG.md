# AWS Granted Changelog

## [1.1.0] - 2026-10-25

- Ranked search for profiles, services and regions: best match first, separators ignored, every word must match, account IDs searchable. An exact account alias such as `acmeio` now comes before `acmeio-preprod` and loose matches like `acme-info-dev`.
- If Granted asks a question (browser choice, MFA), the extension now shows its message at once instead of waiting three minutes.
- Pressing ↵ twice no longer opens two console tabs.
- After five seconds the toast says to finish sign-in in the browser.
- **AWS CLI Profiles** is now off by default. It started the Python AWS CLI on every open to re-read the same config files.

## [1.0.0] - 2026-10-17

- Open the AWS Console through Granted's `assume -c`: pick a profile, a region, then a service.
- Profiles come from `~/.aws/config`, `~/.aws/credentials` and, optionally, `aws configure list-profiles`.
- 60 console services with their official AWS names and icons (AWS Architecture Icons, July 2026), plus the console home.
- All launched commercial, GovCloud and China regions.
- Recent profiles and services, account ID and profile region shown on each profile.
- Copy the profile name or the equivalent `assume` command.
- Works in Tinycast and Raycast.
