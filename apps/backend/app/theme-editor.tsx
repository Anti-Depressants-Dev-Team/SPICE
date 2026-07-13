'use client';

import { useRef, useState } from 'react';

import {
  DEFAULT_PURPLE_PALETTE,
  THEME_COLOR_KEYS,
  THEME_PALETTE_MAX_JSON_LENGTH,
  clearStoredThemePalette,
  exportThemePaletteJson,
  importThemePaletteJson,
  normalizeCssColor,
  saveStoredThemePalette,
  type ThemePalette,
  type ThemeColorKey,
} from '@/lib/theme-palette';

interface ThemeEditorProps {
  palette: ThemePalette;
  enabled: boolean;
  onApply: (palette: ThemePalette) => void;
  onEnabledChange: (enabled: boolean) => void;
}

const COLOR_LABELS: Record<ThemeColorKey, string> = {
  primary: 'Primary accent',
  secondary: 'Secondary accent',
  highlight: 'Highlight',
  textAccent: 'Accent text',
  background: 'App background',
  surface: 'Cards and surfaces',
  surfaceHover: 'Hover surface',
  glass: 'Glass surface',
  border: 'Borders',
};

const clonePalette = (palette: ThemePalette): ThemePalette => ({
  ...palette,
  colors: { ...palette.colors },
});

export default function ThemeEditor({
  palette,
  enabled,
  onApply,
  onEnabledChange,
}: ThemeEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ThemePalette>(() => clonePalette(palette));
  const [status, setStatus] = useState('Edit colors, then apply the palette.');

  const applyPalette = (candidate: ThemePalette) => {
    const result = saveStoredThemePalette(candidate);
    if (!result.ok) {
      setStatus(result.issues?.map((issue) => `${issue.path}: ${issue.message}`).join(' ') || result.error || 'Theme is invalid.');
      return;
    }
    setDraft(clonePalette(result.palette));
    onApply(result.palette);
    onEnabledChange(true);
    setStatus(`Applied “${result.palette.name}”.`);
  };

  const exportPalette = () => {
    try {
      const blobUrl = URL.createObjectURL(new Blob([exportThemePaletteJson(draft)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${draft.id || 'spice-theme'}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      setStatus('Theme palette exported.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Theme export failed.');
    }
  };

  const importPalette = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > THEME_PALETTE_MAX_JSON_LENGTH) {
      setStatus(`Theme files must be ${THEME_PALETTE_MAX_JSON_LENGTH / 1024} KiB or smaller.`);
      return;
    }
    try {
      const imported = importThemePaletteJson(await file.text());
      if (!imported.ok) {
        setStatus(imported.issues.map((issue) => `${issue.path}: ${issue.message}`).join(' '));
        return;
      }
      applyPalette(imported.palette);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Theme import failed.');
    }
  };

  return (
    <div className="theme-editor">
      <div className="theme-editor__header">
        <div>
          <strong>Custom palette editor</strong>
          <span>Safe local palettes with JSON import and export.</span>
        </div>
        <label className="theme-editor__toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          Use custom palette
        </label>
      </div>

      <div className="theme-editor__identity">
        <label>
          Palette name
          <input
            value={draft.name}
            maxLength={64}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label>
          Palette ID
          <input
            value={draft.id}
            maxLength={48}
            onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value.toLocaleLowerCase().replace(/[^a-z0-9_-]/g, '-') }))}
          />
        </label>
      </div>

      <div className="theme-editor__colors">
        {THEME_COLOR_KEYS.map((key) => (
          <label key={key}>
            <span>{COLOR_LABELS[key]}</span>
            <span className="theme-editor__color-input">
              <i
                style={{ background: normalizeCssColor(draft.colors[key]) ?? 'transparent' }}
                aria-hidden="true"
              />
              <input
                value={draft.colors[key]}
                spellCheck={false}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  colors: { ...current.colors, [key]: event.target.value },
                }))}
              />
            </span>
          </label>
        ))}
      </div>

      <div className="theme-editor__actions">
        <button type="button" className="btn btn--primary" onClick={() => applyPalette(draft)}>Apply palette</button>
        <button type="button" className="btn btn--ghost" onClick={exportPalette}>Export JSON</button>
        <button type="button" className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            clearStoredThemePalette();
            const reset = clonePalette(DEFAULT_PURPLE_PALETTE as ThemePalette);
            setDraft(reset);
            onApply(reset);
            onEnabledChange(true);
            setStatus('Reset to the default Spice Purple palette.');
          }}
        >
          Reset purple
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void importPalette(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <p className="theme-editor__status" aria-live="polite">{status}</p>
    </div>
  );
}
