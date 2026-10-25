import assert from "node:assert/strict";
import { test } from "node:test";
import type { Profile } from "./profiles";
import { REGIONS } from "./regions";
import { compact, indexProfile, indexRegion, indexService, prepare, queryTerms, rank, scoreTerm } from "./search";
import { SERVICES } from "./services";

// Made-up names shaped like `granted sso populate` output. The repo is public:
// never use real profile names or account IDs here.
const NAMES = [
  "acme-info-dev.100000000001.AdministratorAccess",
  "acme-poc.100000000002.AdministratorAccess",
  "acme-tech-prod.100000000003.AdministratorAccess",
  "acmeai-dev.100000000004.AdministratorAccess",
  "acmeai-dev.100000000004.PowerUserAccessWithRoles",
  "acmeai-prod.100000000005.AdministratorAccess",
  "acmecloud.100000000006.AdministratorAccess",
  "acmedr.100000000007.AdministratorAccess",
  "acmeio-preprod.100000000008.AdministratorAccess",
  "acme_payer.100000000009.AdministratorAccess",
  "acme-product.100000000010.AdministratorAccess",
  "acme-product.100000000010.PowerUserAccessWithRoles",
  "acmeio.573900000011.AdministratorAccess",
  "acmesap.100000000012.AdministratorAccess",
];
const PROFILES: Profile[] = NAMES.map((name) => ({ name, source: "config", accountId: name.split(".")[1] }));
const PROFILE_INDEX = PROFILES.map(indexProfile);
const byName = (a: Profile, b: Profile) => a.name.length - b.name.length || a.name.localeCompare(b.name);
const searchProfiles = (query: string, tieBreak = byName) => rank(PROFILE_INDEX, query, tieBreak)?.map((p) => p.name);

test("prepare compacts and splits words, including camelCase", () => {
  const p = prepare("acme-io.123.AdministratorAccess");
  assert.equal(p.compact, "acmeio123administratoraccess");
  assert.deepEqual(p.tokens, ["acme", "io", "123", "administrator", "access"]);
  assert.deepEqual([...p.starts], [0, 4, 6, 9, 22]);
  assert.equal(compact(" Acme-IO "), "acmeio");
});

test("queryTerms ignores empty and punctuation-only input", () => {
  assert.deepEqual(queryTerms(""), []);
  assert.deepEqual(queryTerms("   "), []);
  assert.deepEqual(queryTerms(" - "), []);
  assert.deepEqual(queryTerms("Acme-IO  admin"), ["acmeio", "admin"]);
});

test("scoreTerm tiers: exact > prefix > token > token prefix > substring > subsequence", () => {
  const f = prepare("acme-io.123.AdministratorAccess");
  const scores = ["acmeio123administratoraccess", "acmeio", "io", "admin", "eio1", "aiad"].map((t) => scoreTerm(t, f));
  assert.deepEqual(
    [...scores].sort((a, b) => b - a),
    scores,
  );
  assert.equal(scoreTerm("zzz", f), 0);
});

test("an exact account alias ranks first, its siblings next", () => {
  const results = searchProfiles("acmeio")!;
  assert.equal(results[0], "acmeio.573900000011.AdministratorAccess");
  assert.equal(results[1], "acmeio-preprod.100000000008.AdministratorAccess");
  assert.deepEqual(searchProfiles("acme-io")!.slice(0, 2), results.slice(0, 2));
  assert.deepEqual(searchProfiles("ACMEIO")!.slice(0, 2), results.slice(0, 2));
});

test("every word must match (AND), each in its best field", () => {
  assert.equal(searchProfiles("io admin")![0], "acmeio.573900000011.AdministratorAccess");
  const power = searchProfiles("ai power")!;
  assert.equal(power[0], "acmeai-dev.100000000004.PowerUserAccessWithRoles");
  assert.deepEqual(searchProfiles("acmeio nomatch"), []);
});

test("account IDs are searchable by prefix", () => {
  assert.equal(searchProfiles("5739")![0], "acmeio.573900000011.AdministratorAccess");
});

test("ties go to the caller's tie-break (recent first), never above a better match", () => {
  const recent = ["acme-poc.100000000002.AdministratorAccess", "acmeio-preprod.100000000008.AdministratorAccess"];
  const byRecent = (a: Profile, b: Profile) => {
    const ra = recent.indexOf(a.name);
    const rb = recent.indexOf(b.name);
    return (ra === -1 ? Infinity : ra) - (rb === -1 ? Infinity : rb) || byName(a, b);
  };
  const results = searchProfiles("acmeio", byRecent)!;
  assert.equal(results[0], "acmeio.573900000011.AdministratorAccess");
  assert.equal(results[1], "acmeio-preprod.100000000008.AdministratorAccess");
  const all = searchProfiles("access", byRecent)!;
  assert.deepEqual(all.slice(0, 2), recent);
});

test("an empty query means not searching", () => {
  assert.equal(searchProfiles(""), undefined);
  assert.equal(searchProfiles("  "), undefined);
});

const SERVICE_INDEX = SERVICES.map(indexService);
const topService = (query: string) => rank(SERVICE_INDEX, query, (a, b) => a.title.localeCompare(b.title))?.[0]?.id;

test("service aliases rank the right service first", () => {
  assert.equal(topService("s3"), "s3");
  assert.equal(topService("sm"), "secretsmanager");
  assert.equal(topService("cw"), "cloudwatch");
  assert.equal(topService("ec2"), "ec2");
  assert.equal(topService("lambda"), "lambda");
  assert.equal(topService("identity center"), "singlesignon");
  assert.equal(topService("param"), "paramstore");
});

const REGION_INDEX = REGIONS.map(indexRegion);
const searchRegions = (query: string) => rank(REGION_INDEX, query, (a, b) => a.localeCompare(b));

test("region search prefers word starts", () => {
  const results = searchRegions("use2")!;
  assert.ok(results.indexOf("us-east-2") < results.indexOf("us-west-2"));
  assert.equal(results[0], "us-east-2");
  assert.equal(searchRegions("eu-central-1")![0], "eu-central-1");
  assert.deepEqual(searchRegions("ap-south")!.slice(0, 2), ["ap-south-1", "ap-south-2"]);
});
