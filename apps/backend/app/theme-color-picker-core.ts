import { normalizeCssColor } from '../lib/theme-palette.ts';

export interface ThemeHsvaColor {
  hue: number;
  saturation: number;
  value: number;
  alpha: number;
}

const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

const rgbToHsva = (red: number, green: number, blue: number, alpha: number): ThemeHsvaColor => {
  const r = clamp(red / 255);
  const g = clamp(green / 255);
  const b = clamp(blue / 255);
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta > 0) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
    alpha: clamp(alpha),
  };
};

export function parseThemeColor(value: string): ThemeHsvaColor | null {
  const normalized = normalizeCssColor(value);
  if (!normalized) return null;

  if (normalized.startsWith('#')) {
    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    const alpha = normalized.length === 9 ? Number.parseInt(normalized.slice(7, 9), 16) / 255 : 1;
    return rgbToHsva(red, green, blue, alpha);
  }

  const channels = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)$/);
  if (!channels) return null;
  return rgbToHsva(
    Number(channels[1]),
    Number(channels[2]),
    Number(channels[3]),
    channels[4] === undefined ? 1 : Number(channels[4]),
  );
}

const hsvaToRgb = ({ hue, saturation, value }: ThemeHsvaColor): [number, number, number] => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = clamp(value) * clamp(saturation);
  const segment = normalizedHue / 60;
  const intermediate = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = clamp(value) - chroma;
  let channels: [number, number, number];

  if (segment < 1) channels = [chroma, intermediate, 0];
  else if (segment < 2) channels = [intermediate, chroma, 0];
  else if (segment < 3) channels = [0, chroma, intermediate];
  else if (segment < 4) channels = [0, intermediate, chroma];
  else if (segment < 5) channels = [intermediate, 0, chroma];
  else channels = [chroma, 0, intermediate];

  return channels.map((channel) => Math.round((channel + match) * 255)) as [number, number, number];
};

export function themeHsvaToCss(value: ThemeHsvaColor): string {
  const normalized: ThemeHsvaColor = {
    hue: ((value.hue % 360) + 360) % 360,
    saturation: clamp(value.saturation),
    value: clamp(value.value),
    alpha: clamp(value.alpha),
  };
  const [red, green, blue] = hsvaToRgb(normalized);

  if (normalized.alpha < 0.999) {
    const alpha = Number(normalized.alpha.toFixed(2));
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
