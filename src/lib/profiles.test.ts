import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeProfiles, parseProfiles } from "./profiles";

const CONFIG = `
# comment
[default]
region = us-east-1

[profile prod]
sso_account_id = 111111111111
region=eu-west-1

[sso-session corp]
sso_region = us-east-1

[profile   dev  ]
granted_sso_account_id = 222222222222

[profile --exec=open -a Calculator]
region = us-east-1
`;

test("parseProfiles reads config profiles and skips non-profile sections", () => {
  assert.deepEqual(parseProfiles(CONFIG, "config"), [
    { name: "default", source: "config", region: "us-east-1" },
    { name: "prod", source: "config", accountId: "111111111111", region: "eu-west-1" },
    { name: "dev", source: "config", accountId: "222222222222" },
  ]);
});

test("parseProfiles treats every credentials section as a profile", () => {
  const creds = "[default]\naws_access_key_id = x\n[ci]\n; note\naws_access_key_id = y\n";
  assert.deepEqual(
    parseProfiles(creds, "credentials").map((p) => p.name),
    ["default", "ci"],
  );
});

test("parseProfiles drops names that would parse as flags", () => {
  assert.deepEqual(parseProfiles("[-x]\n[ok]\n", "credentials"), [{ name: "ok", source: "credentials" }]);
});

test("mergeProfiles unions by name, keeps first metadata, sorts", () => {
  const merged = mergeProfiles(
    [{ name: "prod", source: "config", region: "eu-west-1" }],
    [
      { name: "prod", source: "credentials", region: "us-east-1", accountId: "1" },
      { name: "a", source: "cli" },
    ],
  );
  assert.deepEqual(merged, [
    { name: "a", source: "cli" },
    { name: "prod", source: "config", region: "eu-west-1", accountId: "1" },
  ]);
});
