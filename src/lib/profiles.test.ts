import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import { describeProfileFiles, mergeProfiles, parseProfiles } from "./profiles";

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

const dir = mkdtempSync(join(tmpdir(), "granted-profiles-test-"));
after(() => rmSync(dir, { recursive: true, force: true }));

test("describeProfileFiles says why each file gave no profiles", async () => {
  writeFileSync(join(dir, "config"), "[default]\n[profile a]\n");
  assert.equal(
    await describeProfileFiles(dir, {}),
    `config: ${dir}/config (2 profiles)\ncredentials: ${dir}/credentials (not found)`,
  );
});

test("describeProfileFiles points at Full Disk Access when the file is blocked", async (t) => {
  if (process.getuid?.() === 0) return t.skip("root ignores file permissions");
  const blocked = mkdtempSync(join(dir, "blocked-"));
  writeFileSync(join(blocked, "config"), "[default]\n");
  chmodSync(join(blocked, "config"), 0o000);
  assert.match(
    await describeProfileFiles(blocked, {}),
    /config: .*\(permission denied; allow your launcher .*Full Disk Access\)/,
  );
});
