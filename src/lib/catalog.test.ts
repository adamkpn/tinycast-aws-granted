import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { homedir } from "node:os";
import { buildPath, EXTRA_PATH, sessionEnv } from "./env";
import { pushRecent } from "./recent-list";
import { DEFAULT_REGION, REGIONS, isValidRegion, regionsWithDefault } from "./regions";
import { SERVICES, findService } from "./services";

const ASSETS = join(__dirname, "..", "..", "assets");

test("every service icon exists in assets/", () => {
  const paths = SERVICES.flatMap((s) => (typeof s.icon === "string" ? [s.icon] : [s.icon.light, s.icon.dark]));
  assert.deepEqual(
    paths.filter((p) => !existsSync(join(ASSETS, p))),
    [],
  );
});

test("every icon in assets/services is used by a service", () => {
  const used = new Set(SERVICES.flatMap((s) => (typeof s.icon === "string" ? [s.icon] : [s.icon.light, s.icon.dark])));
  const files = readdirSync(join(ASSETS, "services")).map((f) => `services/${f}`);
  assert.deepEqual(
    files.filter((f) => !used.has(f)),
    [],
  );
});

test("service ids are unique and findable", () => {
  const ids = SERVICES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(findService("lambda")?.arg, "lambda");
  assert.equal(findService("nope"), undefined);
});

test("regions are valid and the default is always listed first exactly once", () => {
  assert.deepEqual(
    REGIONS.filter((r) => !isValidRegion(r)),
    [],
  );
  for (const def of [DEFAULT_REGION, "eu-west-1"]) {
    const list = regionsWithDefault(def);
    assert.equal(list[0], def);
    assert.equal(list.filter((r) => r === def).length, 1);
    assert.ok(list.includes(DEFAULT_REGION));
  }
  assert.equal(isValidRegion("us-gov-west-1"), true);
  assert.equal(isValidRegion("us-east-2 -x"), false);
});

test("pushRecent moves to front, dedupes and caps", () => {
  assert.deepEqual(pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"]);
  assert.deepEqual(pushRecent(["a", "b", "c", "d", "e"], "f"), ["f", "a", "b", "c", "d"]);
});

test("buildPath prepends system dirs and drops relative entries", () => {
  const path = buildPath(".:bin:/custom/bin:/usr/bin").split(":");
  assert.ok(!path.includes("."));
  assert.ok(!path.includes("bin"));
  assert.ok(path.includes("/custom/bin"));
  assert.equal(path.filter((d) => d === "/usr/bin").length, 1);
  assert.deepEqual(path.slice(0, 2), EXTRA_PATH.filter((d) => d !== "/usr/bin").slice(0, 2));
});

test("sessionEnv fills HOME/USER/LOGNAME/TMPDIR when the runtime leaves them out", () => {
  const env = sessionEnv({});
  assert.equal(env.HOME, homedir());
  assert.ok(env.USER);
  assert.equal(env.LOGNAME, env.USER);
  assert.ok(env.TMPDIR);
  assert.equal(sessionEnv({ HOME: "/Users/x", USER: "x" }).HOME, "/Users/x");
  assert.equal(sessionEnv({ HOME: "/" }).HOME, homedir());
});
