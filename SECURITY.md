# Security Policy

## Reporting a vulnerability

Please report security problems privately through [GitHub's advisory form](https://github.com/adamkpn/tinycast-aws-granted/security/advisories/new), not in a public issue. Include what you found, how to reproduce it and the version.

## Scope

The extension reads profile names, account IDs and regions from your AWS config files, never credentials, and makes no network requests. It runs Granted's `assume` (and optionally `aws configure list-profiles`) with an argument list and no shell. In scope: command injection, running an unintended binary, reading files other than the AWS config and credentials files, and leaking profile data.

Out of scope: vulnerabilities in Granted, the AWS CLI, Raycast, Tinycast or your browser. Report those to their projects.

## Supported versions

Only the latest release gets fixes.
