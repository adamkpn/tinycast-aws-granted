import { accessSync, constants } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { isAbsolute, join } from "node:path";

// Raycast starts extensions with a minimal PATH, so Homebrew and system dirs
// are prepended to find `assume` and `aws`.
export const EXTRA_PATH = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

// Relative entries (".", "bin") are dropped: they resolve against the
// extension's working directory and would let a planted binary win the lookup.
export function buildPath(path = process.env.PATH ?? ""): string {
  const parts = path.split(":").filter((dir) => dir && isAbsolute(dir));
  return [...EXTRA_PATH.filter((dir) => !parts.includes(dir)), ...parts].join(":");
}

// Tinycast's runtime starts extensions with a near-empty process.env, and child
// processes get only what is passed here. Without HOME, Granted still finds its
// config but the browser it launches does not (Firefox: "Profile Missing").
export function sessionEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out = { ...env };
  if (!out.HOME || out.HOME === "/") {
    const home = homedir();
    if (home && home !== "/") out.HOME = home;
  }
  let username = "";
  try {
    username = userInfo().username;
  } catch {
    // userInfo throws when the uid has no passwd entry
  }
  if (!out.USER && username) out.USER = username;
  if (!out.LOGNAME && out.USER) out.LOGNAME = out.USER;
  if (!out.TMPDIR) out.TMPDIR = tmpdir();
  return out;
}

export function toolEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...sessionEnv(), PATH: buildPath(), ...extra };
}

export function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
}

export interface AwsFiles {
  config: string;
  credentials: string;
}

// The "AWS Folder" preference, if it is an absolute (or ~-relative) path.
function awsFolder(folder?: string): string | undefined {
  const path = folder?.trim() ? expandHome(folder.trim()) : undefined;
  return path && isAbsolute(path) ? path : undefined;
}

// Same precedence as the AWS CLI: AWS_CONFIG_FILE / AWS_SHARED_CREDENTIALS_FILE
// win, then the AWS Folder preference, then ~/.aws. GUI launchers rarely pass
// shell env vars, which is why the preference exists.
export function awsFiles(folder?: string, env: NodeJS.ProcessEnv = process.env): AwsFiles {
  const dir = awsFolder(folder) ?? join(homedir(), ".aws");
  return {
    config: env.AWS_CONFIG_FILE || join(dir, "config"),
    credentials: env.AWS_SHARED_CREDENTIALS_FILE || join(dir, "credentials"),
  };
}

// Env for `assume` and `aws` so they read the same files the list shows.
export function awsFilesEnv(folder?: string, env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  if (!awsFolder(folder)) return {};
  const files = awsFiles(folder, env);
  return { AWS_CONFIG_FILE: files.config, AWS_SHARED_CREDENTIALS_FILE: files.credentials };
}

// An explicit override must be an absolute (or ~-relative) executable path;
// otherwise search the PATH built above.
export function findBinary(name: string, override?: string): string | undefined {
  const explicit = override?.trim();
  if (explicit) {
    const path = expandHome(explicit);
    return isAbsolute(path) && isExecutable(path) ? path : undefined;
  }
  for (const dir of buildPath().split(":")) {
    const candidate = join(dir, name);
    if (isExecutable(candidate)) return candidate;
  }
  return undefined;
}
