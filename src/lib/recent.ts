import { LocalStorage } from "@raycast/api";
import { pushRecent } from "./recent-list";

export type RecentKind = "profiles" | "services";

export async function getRecent(kind: RecentKind): Promise<string[]> {
  try {
    const raw = await LocalStorage.getItem<string>(`recent:${kind}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function addRecent(kind: RecentKind, item: string): Promise<void> {
  const next = pushRecent(await getRecent(kind), item);
  await LocalStorage.setItem(`recent:${kind}`, JSON.stringify(next));
}
