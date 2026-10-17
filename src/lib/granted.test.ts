import assert from "node:assert/strict";
import { test } from "node:test";
import { assumeArgs, assumeCommand, isSafeProfileName } from "./granted";

test("assumeArgs builds -c/-s/-r in Granted's order", () => {
  assert.deepEqual(assumeArgs({ profile: "prod", service: "lambda", region: "eu-west-1" }), [
    "-c",
    "prod",
    "-s",
    "lambda",
    "-r",
    "eu-west-1",
  ]);
  assert.deepEqual(assumeArgs({ profile: "prod", region: "us-east-2" }), ["-c", "prod", "-r", "us-east-2"]);
});

test("assumeArgs rejects unsafe input", () => {
  assert.throws(() => assumeArgs({ profile: "", region: "us-east-2" }), /profile is required/);
  assert.throws(() => assumeArgs({ profile: "--exec=id", region: "us-east-2" }), /invalid profile/);
  assert.throws(() => assumeArgs({ profile: "prod", region: "us-east-2; id" }), /invalid region/);
});

test("isSafeProfileName", () => {
  assert.equal(isSafeProfileName("team/prod.admin@corp"), true);
  assert.equal(isSafeProfileName("my profile"), true);
  assert.equal(isSafeProfileName("-x"), false);
  assert.equal(isSafeProfileName("a\nb"), false);
});

test("assumeCommand shell-quotes only when needed", () => {
  assert.equal(
    assumeCommand({ profile: "prod", service: "s3", region: "us-east-1" }),
    "assume -c prod -s s3 -r us-east-1",
  );
  assert.equal(assumeCommand({ profile: "it's me", region: "us-east-1" }), "assume -c 'it'\\''s me' -r us-east-1");
});
