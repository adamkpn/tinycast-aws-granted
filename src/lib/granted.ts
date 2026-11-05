import { execFile } from "node:child_process";
import { awsFilesEnv, findBinary, toolEnv } from "./env";
import { isValidRegion } from "./regions";

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

export const ASSUME_TIMEOUT_MS = 180_000;

// Granted colours its output and moves the cursor while drawing its profile
// picker; none of that belongs in a toast.
export function stripTerminalCodes(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x1b) {
      if (text[i + 1] === "[") {
        i += 2;
        while (i < text.length && (text.charCodeAt(i) < 0x40 || text.charCodeAt(i) > 0x7e)) i++;
      } else {
        i += 1; // two-character sequence such as ESC 7 / ESC 8
      }
    } else if (code >= 0x20 || code === 0x0a) {
      out += text[i];
    }
  }
  return out;
}

const lines = (text: string) =>
  stripTerminalCodes(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

// Granted prefixes its error lines with "[✘]", and exits 0 after one when it
// gives up on a prompt (end of input), so the exit code alone can't be trusted.
const ERROR_MARK = "[✘]";

function failureMessage(errorLines: string[]): string {
  const detail = errorLines.map((line) => line.replace(ERROR_MARK, "").trim()).join(" ");
  return detail === "EOF"
    ? "Granted needed an answer it couldn't get (EOF). Check that the profile exists, or run the copied assume command in a terminal."
    : detail;
}

const duration = (ms: number) =>
  ms >= 60_000 ? `${Math.round(ms / 60_000)} minutes` : `${Math.round(ms / 1000)} seconds`;

export async function openConsole(
  options: AssumeOptions,
  assumePath?: string,
  awsFolder?: string,
  timeoutMs = ASSUME_TIMEOUT_MS,
): Promise<void> {
  const bin = findBinary("assume", assumePath);
  if (!bin) throw new AssumeNotFoundError();
  const args = assumeArgs(options);
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      bin,
      args,
      { env: toolEnv({ GRANTED_ALIAS_CONFIGURED: "true", ...awsFilesEnv(awsFolder) }), timeout: timeoutMs },
      (err, _stdout, stderr) => {
        const output = lines(String(stderr ?? ""));
        const marked = output.filter((line) => line.includes(ERROR_MARK));
        if (err?.killed) {
          return reject(
            new Error(
              `Granted did not finish within ${duration(timeoutMs)}. Run the copied assume command in a terminal to see why.`,
            ),
          );
        }
        if (err)
          return reject(new Error(output.slice(-3).join(" ") || lines(err.message).join(" ") || "unknown error"));
        if (marked.length) return reject(new Error(failureMessage(marked)));
        resolve();
      },
    );
    // Nobody can answer a Granted prompt here (browser choice, MFA). With
    // stdin closed it fails at once instead of hanging until the timeout.
    child.stdin?.end();
  });
}
