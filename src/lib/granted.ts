import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findBinary, toolEnv } from "./env";
import { isValidRegion } from "./regions";

const execFileAsync = promisify(execFile);

export interface AssumeOptions {
  profile: string;
  service?: string;
  region: string;
}

// A profile name starting with "-" would be parsed by `assume` as a flag
// (e.g. `--exec=...`), so such names are never passed through.
export function isSafeProfileName(name: string): boolean {
  const hasControlChar = [...name].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f);
  return name.length > 0 && !name.startsWith("-") && !hasControlChar;
}

export function assumeArgs({ profile, service, region }: AssumeOptions): string[] {
  if (!profile) throw new Error("profile is required");
  if (!isSafeProfileName(profile)) throw new Error(`invalid profile name: ${JSON.stringify(profile)}`);
  if (!isValidRegion(region)) throw new Error(`invalid region: ${JSON.stringify(region)}`);
  const args = ["-c", profile];
  if (service) args.push("-s", service);
  args.push("-r", region);
  return args;
}

// The command as a user would type it in a shell, for "Copy Assume Command".
export function assumeCommand(options: AssumeOptions): string {
  const quote = (arg: string) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`);
  return ["assume", ...assumeArgs(options)].map(quote).join(" ");
}

export class AssumeNotFoundError extends Error {
  constructor() {
    super(
      "Granted `assume` not found. Install it with `brew install fwdcloudsec/granted/granted` or set its path in preferences.",
    );
  }
}

export async function openConsole(options: AssumeOptions, assumePath?: string): Promise<void> {
  const bin = findBinary("assume", assumePath);
  if (!bin) throw new AssumeNotFoundError();
  try {
    await execFileAsync(bin, assumeArgs(options), {
      env: toolEnv({ GRANTED_ALIAS_CONFIGURED: "true" }),
      timeout: 180_000,
    });
  } catch (err) {
    const { stderr, message } = err as { stderr?: string; message?: string };
    const detail = (stderr || message || "unknown error").trim().split("\n").slice(-3).join(" ");
    throw new Error(detail);
  }
}
