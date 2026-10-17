export const MAX_RECENT = 5;

// Most-recent-first list with `item` moved to the front, capped at `max`.
export function pushRecent(list: string[], item: string, max = MAX_RECENT): string[] {
  return [item, ...list.filter((x) => x !== item)].slice(0, max);
}
