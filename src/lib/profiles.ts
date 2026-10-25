import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { awsFiles, awsFilesEnv, findBinary, toolEnv } from "./env";
import { isSafeProfileName } from "./granted";

const execFileAsync = promisify(execFile);

export type ProfileSource = "config" | "credentials" | "cli";

export interface Profile {
  name: string;
  source: ProfileSource;
  region?: string;
  accountId?: string;
}

// Minimal INI reader for ~/.aws/config and ~/.aws/credentials. In the config
// file only `[default]` and `[profile x]` are profiles (`[sso-session x]` is
// not); in the credentials file every section is.
export function parseProfiles(text: string, source: "config" | "credentials"): Profile[] {
  const profiles: Profile[] = [];
  let current: Profile | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const section = /^\[\s*(.+?)\s*\]$/.exec(line);
    if (section) {
      const name = section[1];
      current = undefined;
      if (source === "credentials") current = { name, source };
      else if (name === "default") current = { name: "default", source };
      else if (/^profile\s+/.test(name)) current = { name: name.replace(/^profile\s+/, "").trim(), source };
      if (current && !isSafeProfileName(current.name)) current = undefined;
      if (current) profiles.push(current);
      continue;
    }
    if (!current) continue;

    const kv = /^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === "region") current.region = value;
    if ((key === "sso_account_id" || key === "granted_sso_account_id") && !current.accountId) current.accountId = value;
  }
  return profiles;
}

async function readProfileFile(path: string, source: "config" | "credentials"): Promise<Profile[]> {
  try {
    return parseProfiles(await readFile(path, "utf8"), source);
  } catch {
    return [];
  }
}

// Union by name, sorted. The first list to set region/accountId wins.
export function mergeProfiles(...lists: Profile[][]): Profile[] {
  const byName = new Map<string, Profile>();
  for (const list of lists) {
    for (const profile of list) {
      const existing = byName.get(profile.name);
      if (existing) {
        existing.region ??= profile.region;
        existing.accountId ??= profile.accountId;
      } else {
        byName.set(profile.name, { ...profile });
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadProfilesFromFiles(folder?: string): Promise<Profile[]> {
  const files = awsFiles(folder);
  const [config, credentials] = await Promise.all([
    readProfileFile(files.config, "config"),
    readProfileFile(files.credentials, "credentials"),
  ]);
  return mergeProfiles(config, credentials);
}

export async function loadProfilesFromCli(folder?: string): Promise<Profile[]> {
  const aws = findBinary("aws");
  if (!aws) return [];
  try {
    const { stdout } = await execFileAsync(aws, ["configure", "list-profiles"], {
      env: toolEnv(awsFilesEnv(folder)),
      timeout: 10_000,
    });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(isSafeProfileName)
      .map((name) => ({ name, source: "cli" as const }));
  } catch {
    return [];
  }
}

export function profileDebugInfo(folder?: string): string {
  const files = awsFiles(folder);
  return `config=${files.config} credentials=${files.credentials}`;
}
