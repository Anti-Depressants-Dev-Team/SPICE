export interface CommandPaletteEntry {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  shortcut?: string;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export function commandPaletteMatches(entry: CommandPaletteEntry, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  const searchable = [entry.label, entry.description ?? '', ...(entry.keywords ?? [])]
    .join(' ')
    .toLocaleLowerCase();
  return normalizedQuery.split(/\s+/).every((token) => searchable.includes(token));
}

function commandPaletteMatchScore(entry: CommandPaletteEntry, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  const label = normalize(entry.label);
  if (label === normalizedQuery) return 0;
  if (label.startsWith(normalizedQuery)) return 1;
  const tokens = normalizedQuery.split(/\s+/);
  if (tokens.every((token) => label.includes(token))) return 2;
  const keywords = (entry.keywords ?? []).join(' ').toLocaleLowerCase();
  if (tokens.every((token) => keywords.includes(token))) return 3;
  const description = (entry.description ?? '').toLocaleLowerCase();
  if (tokens.every((token) => description.includes(token))) return 4;
  return 5;
}

export function filterCommandPaletteEntries<T extends CommandPaletteEntry>(
  entries: readonly T[],
  query: string,
  limit = 12,
) {
  const boundedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 12;
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => commandPaletteMatches(entry, query))
    .sort((left, right) => (
      commandPaletteMatchScore(left.entry, query) - commandPaletteMatchScore(right.entry, query)
      || left.index - right.index
    ))
    .slice(0, boundedLimit)
    .map(({ entry }) => entry);
}

export function isCommandPaletteShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>) {
  return event.key.toLocaleLowerCase() === 'k'
    && (event.ctrlKey || event.metaKey)
    && !event.altKey;
}
