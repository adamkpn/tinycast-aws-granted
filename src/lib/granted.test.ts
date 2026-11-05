import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { assumeArgs, assumeCommand, isSafeProfileName, openConsole, stripTerminalCodes } from "./granted";

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

// Fake `assume` binaries for openConsole.
const dir = mkdtempSync(join(tmpdir(), "aws-granted-test-"));
after(() => rmSync(dir, { recursive: true, force: true }));
function fakeAssume(name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}
const OPTIONS = { profile: "prod", region: "us-east-1" };

test("openConsole resolves when assume succeeds", async () => {
  await openConsole(OPTIONS, fakeAssume("ok", 'test "$1 $2 $3 $4" = "-c prod -r us-east-1" || exit 9'));
});

test("openConsole reports the last stderr lines when assume fails", async () => {
  const bin = fakeAssume("fail", 'echo "line 1" >&2; echo "no such profile" >&2; exit 1');
  await assert.rejects(openConsole(OPTIONS, bin), /line 1 no such profile/);
});

test("openConsole fails fast when assume waits for an answer", async () => {
  const bin = fakeAssume("prompt", 'read answer || { echo "prompt: no input" >&2; exit 1; }');
  const started = Date.now();
  await assert.rejects(openConsole(OPTIONS, bin), /prompt: no input/);
  assert.ok(Date.now() - started < 5000);
});

test("stripTerminalCodes removes colour and cursor sequences", () => {
  assert.equal(stripTerminalCodes("\x1b[0;31m[\u2718] EOF\x1b[0m"), "[\u2718] EOF");
  assert.equal(stripTerminalCodes("a\x1b7\x1b[1A\x1b[0G\x1b8\x1b[?25hb\r\n"), "ab\n");
});

test("openConsole strips terminal codes from the error message", async () => {
  const bin = fakeAssume("ansi", "printf '\\033[0;31mbad profile\\033[0m\\n' >&2; exit 1");
  await assert.rejects(openConsole(OPTIONS, bin), (err: Error) => err.message === "bad profile");
});

test("openConsole fails when assume prints an error but exits 0", async () => {
  // Granted's picker gives up on end of input with "[\u2718] EOF" and exit code 0.
  const bin = fakeAssume(
    "eof",
    "printf '\\033[0;39m  prod\\033[0m\\n\\033[0;31m[\\342\\234\\230] EOF\\033[0m\\n' >&2; exit 0",
  );
  await assert.rejects(openConsole(OPTIONS, bin), /needed an answer it couldn't get/);
  const other = fakeAssume("marked", "echo '[\u2718] profile not found' >&2");
  await assert.rejects(openConsole(OPTIONS, other), (err: Error) => err.message === "profile not found");
});

test("openConsole ignores other stderr output when assume succeeds", async () => {
  await openConsole(OPTIONS, fakeAssume("noisy", "echo 'warning: something' >&2"));
});

test("openConsole explains a timeout instead of showing the command line", async () => {
  const bin = fakeAssume("slow", "exec sleep 5");
  const started = Date.now();
  await assert.rejects(openConsole(OPTIONS, bin, undefined, 300), /did not finish within \d+ seconds/);
  assert.ok(Date.now() - started < 4000);
});
