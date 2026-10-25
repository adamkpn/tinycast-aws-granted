import type { Profile } from "./profiles";
import type { Service } from "./services";

// Ranked search for the lists. The host's built-in filter only hides
// non-matches and keeps list order, so an exact profile could sit below a
// dozen loose matches; this scores every item and sorts by score instead.

export interface Prepared {
  compact: string; // lowercase, alphanumerics only: "plainid-io" -> "plainidio"
  tokens: string[]; // words, camelCase split: "AdministratorAccess" -> administrator, access
  starts: Set<number>; // index in `compact` where each token begins
}

export interface Field {
  value: Prepared;
  weight: number;
}

export interface Indexed<T> {
  item: T;
  fields: Field[];
}

export function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function prepare(text: string): Prepared {
  const tokens = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const starts = new Set<number>();
  let offset = 0;
  for (const token of tokens) {
    starts.add(offset);
    offset += token.length;
  }
  return { compact: tokens.join(""), tokens, starts };
}

export function queryTerms(query: string): string[] {
  return query.split(/\s+/).map(compact).filter(Boolean);
}

// Letters of `term` appear in order in `field`. Greedy left-to-right match,
// scored like awgo/fzf: bonus for word starts and consecutive letters,
// penalty for skipped characters. Range 100-399, or 0 for no match.
function subsequenceScore(term: string, field: Prepared): number {
  const text = field.compact;
  let score = 100;
  let previous = -1;
  for (const ch of term) {
    const index = text.indexOf(ch, previous + 1);
    if (index === -1) return 0;
    if (field.starts.has(index)) score += 15;
    if (index === previous + 1 && previous !== -1) score += 8;
    score -= index - previous - 1;
    previous = index;
  }
  return Math.min(399, Math.max(100, score));
}

// One compacted search term against one field; higher tiers always win.
export function scoreTerm(term: string, field: Prepared): number {
  const text = field.compact;
  if (!term || !text) return 0;
  if (text === term) return 1000;
  if (text.startsWith(term)) return 900 - Math.min(text.length - term.length, 99);
  if (field.tokens.includes(term)) return 800;
  const prefixLeftover = field.tokens
    .filter((token) => token.startsWith(term))
    .map((token) => token.length - term.length);
  if (prefixLeftover.length) return 700 - Math.min(Math.min(...prefixLeftover), 99);
  if (text.includes(term)) return 500;
  return subsequenceScore(term, field);
}

// Every term must match some field (AND); each term counts its best field.
export function scoreFields(terms: string[], fields: Field[]): number {
  let total = 0;
  for (const term of terms) {
    const best = Math.max(0, ...fields.map((f) => scoreTerm(term, f.value) * f.weight));
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

// Matching items, best first. Returns undefined when the query has no terms,
// meaning "not searching": show the normal sections.
export function rank<T>(index: Indexed<T>[], query: string, tieBreak: (a: T, b: T) => number): T[] | undefined {
  const terms = queryTerms(query);
  if (!terms.length) return undefined;
  return index
    .map((entry) => ({ item: entry.item, score: scoreFields(terms, entry.fields) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || tieBreak(a.item, b.item))
    .map((entry) => entry.item);
}

const field = (text: string | undefined, weight: number): Field[] => (text ? [{ value: prepare(text), weight }] : []);

export function indexProfile(profile: Profile): Indexed<Profile> {
  return {
    item: profile,
    fields: [
      ...field(profile.name, 1),
      ...field(profile.name.split(".")[0], 1),
      ...field(profile.accountId, 0.9),
      ...field(profile.region, 0.5),
    ],
  };
}

export function indexService(service: Service): Indexed<Service> {
  return {
    item: service,
    fields: [
      ...field(service.arg, 1),
      ...field(service.id, 1),
      ...field(service.title, 0.9),
      ...field(service.keywords, 0.7),
    ],
  };
}

export function indexRegion(region: string): Indexed<string> {
  return { item: region, fields: field(region, 1) };
}
