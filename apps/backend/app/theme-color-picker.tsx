'use client';

import { useMemo, type CSSProperties } from 'react';

import { parseThemeColor, themeHsvaToCss, type ThemeHsvaColor } from './theme-color-picker-core';

interface ThemeColorPickerProps {
  label: string;
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}

const fallbackColor: ThemeHsvaColor = { hue: 270, saturation: 0.65, value: 0.95, alpha: 1 };
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function ThemeColorPicker({
  label,
  value,
  open,
  onOpenChange,
  onChange,
}: ThemeColorPickerProps) {
  const color = useMemo(() => parseThemeColor(value) ?? fallbackColor, [value]);

  const commit = (next: ThemeHsvaColor) => onChange(themeHsvaToCss(next));
  const updateSpectrum = (element: HTMLDivElement, clientX: number, clientY: number) => {
    const bounds = element.getBoundingClientRect();
    commit({
      ...color,
      saturation: clamp((clientX - bounds.left) / bounds.width),
      value: clamp(1 - (clientY - bounds.top) / bounds.height),
    });
  };

  return (
    <div className={`theme-color-picker ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="theme-color-picker__summary"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="theme-color-picker__swatch" style={{ background: value }} aria-hidden="true" />
        <span className="theme-color-picker__summary-copy">
          <strong>{label}</strong>
          <small>{Math.round(color.alpha * 100)}% opacity</small>
        </span>
        <span className="theme-color-picker__edit" aria-hidden="true">{open ? 'Done' : 'Edit'}</span>
      </button>

      {open && (
        <div className="theme-color-picker__panel">
          <div
            className="theme-color-picker__spectrum"
            style={{ backgroundColor: `hsl(${color.hue} 100% 50%)` }}
            role="slider"
            tabIndex={0}
            aria-label={`${label} saturation and brightness`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(color.value * 100)}
            aria-valuetext={`${Math.round(color.saturation * 100)}% saturation, ${Math.round(color.value * 100)}% brightness`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateSpectrum(event.currentTarget, event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                updateSpectrum(event.currentTarget, event.clientX, event.clientY);
              }
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.1 : 0.02;
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              commit({
                ...color,
                saturation: clamp(color.saturation + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)),
                value: clamp(color.value + (event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0)),
              });
            }}
          >
            <span
              className="theme-color-picker__cursor"
              style={{ left: `${color.saturation * 100}%`, top: `${(1 - color.value) * 100}%`, background: value }}
              aria-hidden="true"
            />
          </div>

          <div className="theme-color-picker__controls">
            <label>
              <span>Hue</span>
              <input
                className="theme-color-picker__hue"
                type="range"
                min="0"
                max="359"
                value={Math.round(color.hue)}
                aria-label={`${label} hue`}
                onChange={(event) => commit({ ...color, hue: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>Opacity <b>{Math.round(color.alpha * 100)}%</b></span>
              <input
                className="theme-color-picker__alpha"
                type="range"
                min="0"
                max="100"
                value={Math.round(color.alpha * 100)}
                aria-label={`${label} opacity`}
                style={{ '--picker-color': themeHsvaToCss({ ...color, alpha: 1 }) } as CSSProperties}
                onChange={(event) => commit({ ...color, alpha: Number(event.target.value) / 100 })}
              />
            </label>
            <div className="theme-color-picker__preview">
              <span style={{ background: value }} aria-hidden="true" />
              <div><strong>Live swatch</strong><small>Drag anywhere on the graph</small></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
