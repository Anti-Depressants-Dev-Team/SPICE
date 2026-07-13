export const THEME_PALETTE_SCHEMA = 'spice-theme-palette' as const;
export const THEME_PALETTE_VERSION = 1 as const;
export const THEME_PALETTE_STORAGE_KEY = 'spice_custom_theme_palette';
export const THEME_PALETTE_MAX_JSON_LENGTH = 16_384;

export const THEME_COLOR_KEYS = [
  'primary',
  'secondary',
  'highlight',
  'textAccent',
  'background',
  'surface',
  'surfaceHover',
  'glass',
  'border',
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export type ThemePaletteColors = Record<ThemeColorKey, string>;

export interface ThemePalette {
  schema: typeof THEME_PALETTE_SCHEMA;
  version: typeof THEME_PALETTE_VERSION;
  id: string;
  name: string;
  colors: ThemePaletteColors;
}

export interface ThemeValidationIssue {
  path: string;
  message: string;
}

export type ThemePaletteValidationResult =
  | { ok: true; palette: ThemePalette }
  | { ok: false; issues: ThemeValidationIssue[] };

export interface ThemeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ThemePaletteLoadResult = {
  palette: ThemePalette;
  source: 'stored' | 'default';
  storageAvailable: boolean;
  issues?: ThemeValidationIssue[];
  error?: string;
};

export type ThemePaletteSaveResult =
  | { ok: true; palette: ThemePalette }
  | { ok: false; issues?: ThemeValidationIssue[]; error?: string };

const DEFAULT_PURPLE_COLORS: ThemePaletteColors = Object.freeze({
  primary: '#a855f7',
  secondary: '#7c3aed',
  highlight: '#c084fc',
  textAccent: '#d8b4fe',
  background: '#050507',
  surface: '#111018',
  surfaceHover: '#211a2e',
  glass: 'rgba(11, 8, 18, 0.82)',
  border: 'rgba(168, 85, 247, 0.24)',
});

export const DEFAULT_PURPLE_PALETTE: Readonly<ThemePalette> = Object.freeze({
  schema: THEME_PALETTE_SCHEMA,
  version: THEME_PALETTE_VERSION,
  id: 'spice-purple',
  name: 'Spice Purple',
  colors: DEFAULT_PURPLE_COLORS,
});

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_PATTERN = /^rgba?\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)%?)\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)%?)\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)%?)(?:\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)%?))?\s*\)$/i;
const PALETTE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function clonePalette(palette: Readonly<ThemePalette>): ThemePalette {
  return {
    schema: palette.schema,
    version: palette.version,
    id: palette.id,
    name: palette.name,
    colors: { ...palette.colors },
  };
}

function formatAlpha(value: number) {
  return Number(value.toFixed(3)).toString();
}

function parseRgbChannel(token: string): number | null {
  if (token.endsWith('%')) {
    const percentage = Number(token.slice(0, -1));
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return null;
    return Math.round((percentage / 100) * 255);
  }

  const value = Number(token);
  if (!Number.isFinite(value) || value < 0 || value > 255) return null;
  return Math.round(value);
}

function parseAlphaChannel(token: string): number | null {
  if (token.endsWith('%')) {
    const percentage = Number(token.slice(0, -1));
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return null;
    return percentage / 100;
  }

  const value = Number(token);
  if (!Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

/**
 * Accepts only literal hex and rgb/rgba colors and returns a canonical value.
 * CSS functions such as var(), url(), gradients, and delimiter injection are
 * deliberately rejected so the result is safe to place in generated CSS.
 */
export function normalizeCssColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > 64) return null;

  const hexMatch = candidate.match(HEX_COLOR_PATTERN);
  if (hexMatch) {
    const compact = hexMatch[1].toLowerCase();
    if (compact.length === 3 || compact.length === 4) {
      return `#${[...compact].map((character) => character.repeat(2)).join('')}`;
    }
    return `#${compact}`;
  }

  const rgbMatch = candidate.match(RGB_COLOR_PATTERN);
  if (!rgbMatch) return null;

  const red = parseRgbChannel(rgbMatch[1]);
  const green = parseRgbChannel(rgbMatch[2]);
  const blue = parseRgbChannel(rgbMatch[3]);
  if (red === null || green === null || blue === null) return null;

  const functionName = candidate.slice(0, candidate.indexOf('(')).toLowerCase();
  const alphaToken = rgbMatch[4];
  if (functionName === 'rgba' && alphaToken === undefined) return null;
  if (functionName === 'rgb' && alphaToken !== undefined) return null;
  if (alphaToken === undefined) return `rgb(${red}, ${green}, ${blue})`;

  const alpha = parseAlphaChannel(alphaToken);
  if (alpha === null) return null;
  return `rgba(${red}, ${green}, ${blue}, ${formatAlpha(alpha)})`;
}

function normalizePaletteId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return PALETTE_ID_PATTERN.test(normalized) ? normalized : null;
}

function normalizePaletteName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > 64 || CONTROL_CHARACTER_PATTERN.test(normalized)) return null;
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateThemePalette(value: unknown): ThemePaletteValidationResult {
  if (!isRecord(value)) {
    return { ok: false, issues: [{ path: '$', message: 'Theme palette must be an object.' }] };
  }

  const issues: ThemeValidationIssue[] = [];
  if (value.schema !== THEME_PALETTE_SCHEMA) {
    issues.push({ path: 'schema', message: `Expected schema "${THEME_PALETTE_SCHEMA}".` });
  }
  if (value.version !== THEME_PALETTE_VERSION) {
    issues.push({ path: 'version', message: `Only palette version ${THEME_PALETTE_VERSION} is supported.` });
  }

  const id = normalizePaletteId(value.id);
  if (!id) {
    issues.push({ path: 'id', message: 'Use 1-48 lowercase letters, numbers, hyphens, or underscores.' });
  }

  const name = normalizePaletteName(value.name);
  if (!name) {
    issues.push({ path: 'name', message: 'Name must contain 1-64 printable characters.' });
  }

  const normalizedColors = {} as ThemePaletteColors;
  if (!isRecord(value.colors)) {
    issues.push({ path: 'colors', message: 'Colors must be an object.' });
  } else {
    for (const key of THEME_COLOR_KEYS) {
      const normalized = normalizeCssColor(value.colors[key]);
      if (!normalized) {
        issues.push({ path: `colors.${key}`, message: 'Use a literal hex, rgb(), or rgba() color.' });
      } else {
        normalizedColors[key] = normalized;
      }
    }
  }

  if (issues.length > 0 || !id || !name) return { ok: false, issues };

  return {
    ok: true,
    palette: {
      schema: THEME_PALETTE_SCHEMA,
      version: THEME_PALETTE_VERSION,
      id,
      name,
      colors: normalizedColors,
    },
  };
}

export function importThemePaletteJson(json: unknown): ThemePaletteValidationResult {
  if (typeof json !== 'string') {
    return { ok: false, issues: [{ path: '$', message: 'Imported theme must be JSON text.' }] };
  }
  if (json.length > THEME_PALETTE_MAX_JSON_LENGTH) {
    return { ok: false, issues: [{ path: '$', message: 'Imported theme is too large.' }] };
  }

  try {
    return validateThemePalette(JSON.parse(json));
  } catch {
    return { ok: false, issues: [{ path: '$', message: 'Imported theme is not valid JSON.' }] };
  }
}

export function exportThemePaletteJson(value: unknown): string {
  const validation = validateThemePalette(value);
  if (!validation.ok) {
    throw new TypeError(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join(' '));
  }
  return JSON.stringify(validation.palette, null, 2);
}

function getDefaultBrowserStorage(): ThemeStorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredThemePalette(storage: ThemeStorageLike | null = getDefaultBrowserStorage()): ThemePaletteLoadResult {
  if (!storage) {
    return { palette: clonePalette(DEFAULT_PURPLE_PALETTE), source: 'default', storageAvailable: false };
  }

  try {
    const storedJson = storage.getItem(THEME_PALETTE_STORAGE_KEY);
    if (storedJson === null) {
      return { palette: clonePalette(DEFAULT_PURPLE_PALETTE), source: 'default', storageAvailable: true };
    }

    const imported = importThemePaletteJson(storedJson);
    if (!imported.ok) {
      return {
        palette: clonePalette(DEFAULT_PURPLE_PALETTE),
        source: 'default',
        storageAvailable: true,
        issues: imported.issues,
      };
    }
    return { palette: imported.palette, source: 'stored', storageAvailable: true };
  } catch (error) {
    return {
      palette: clonePalette(DEFAULT_PURPLE_PALETTE),
      source: 'default',
      storageAvailable: true,
      error: error instanceof Error ? error.message : 'Unable to read theme storage.',
    };
  }
}

export function saveStoredThemePalette(
  value: unknown,
  storage: ThemeStorageLike | null = getDefaultBrowserStorage(),
): ThemePaletteSaveResult {
  const validation = validateThemePalette(value);
  if (!validation.ok) return validation;
  if (!storage) return { ok: false, error: 'Theme storage is unavailable.' };

  try {
    storage.setItem(THEME_PALETTE_STORAGE_KEY, exportThemePaletteJson(validation.palette));
    return validation;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to save theme palette.',
    };
  }
}

export function clearStoredThemePalette(storage: ThemeStorageLike | null = getDefaultBrowserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(THEME_PALETTE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function normalizedColorRgbChannels(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    return [
      Number.parseInt(color.slice(1, 3), 16),
      Number.parseInt(color.slice(3, 5), 16),
      Number.parseInt(color.slice(5, 7), 16),
    ];
  }
  const match = color.match(RGB_COLOR_PATTERN);
  return [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])];
}

/** Returns normalized values that can be assigned with style.setProperty(). */
export function createThemeCssVariables(value: unknown): Record<string, string> | null {
  const validation = validateThemePalette(value);
  if (!validation.ok) return null;
  const { colors } = validation.palette;
  const primaryRgb = normalizedColorRgbChannels(colors.primary).join(', ');

  return {
    '--accent-pink': colors.primary,
    '--accent-pink-rgb': primaryRgb,
    '--accent-purple': colors.secondary,
    '--accent-violet': colors.primary,
    '--accent-cyan': colors.highlight,
    '--accent-gradient': `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
    '--text-accent': colors.textAccent,
    '--body-bg': colors.background,
    '--bg-primary': colors.background,
    '--spice-app-background': colors.background,
    '--card-bg': colors.surface,
    '--bg-surface': colors.surface,
    '--bg-surface-hover': colors.surfaceHover,
    '--bg-surface-active': colors.surfaceHover,
    '--bg-glass': colors.glass,
    '--bg-glass-hover': colors.surfaceHover,
    '--border-color': colors.border,
    '--border-subtle': colors.border,
    '--border-glass': colors.border,
  };
}
