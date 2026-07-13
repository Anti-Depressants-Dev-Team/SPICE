'use client';

import { useEffect, useRef, useState } from 'react';

import { filterCommandPaletteEntries, type CommandPaletteEntry } from './command-palette-core';

export interface CommandPaletteCommand extends CommandPaletteEntry {
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: CommandPaletteCommand[];
  onClose: () => void;
  onQuickSearch: (query: string) => void;
}

export default function CommandPalette({
  open,
  commands,
  onClose,
  onQuickSearch,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filteredCommands = filterCommandPaletteEntries(commands, query);
  const hasQuickSearch = query.trim().length > 0;
  const resultCount = filteredCommands.length + (hasQuickSearch ? 1 : 0);
  const effectiveSelectedIndex = Math.min(selectedIndex, Math.max(0, resultCount - 1));
  const activeOptionId = effectiveSelectedIndex < filteredCommands.length
    ? `spice-command-option-${filteredCommands[effectiveSelectedIndex]?.id}`
    : hasQuickSearch ? 'spice-command-option-quick-search' : undefined;
  const closePalette = () => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !activeOptionId) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeOptionId, open]);

  if (!open) return null;

  const runSelected = () => {
    if (effectiveSelectedIndex < filteredCommands.length) {
      filteredCommands[effectiveSelectedIndex]?.run();
    } else if (hasQuickSearch) {
      onQuickSearch(query.trim());
    }
    closePalette();
  };

  return (
    <div className="command-palette" role="presentation" onMouseDown={closePalette}>
      <section
        ref={dialogRef}
        className="command-palette__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette and quick search"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDownCapture={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closePalette();
            return;
          }
          if (event.key !== 'Tab') return;
          const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled]):not([tabindex="-1"])') ?? []);
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="command-palette__input-row">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((current) => resultCount > 0 ? (current + 1) % resultCount : 0);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((current) => resultCount > 0 ? (current - 1 + resultCount) % resultCount : 0);
              } else if (event.key === 'Enter' && resultCount > 0) {
                event.preventDefault();
                runSelected();
              }
            }}
            placeholder="Type a command or search your music..."
            aria-label="Command or search query"
            role="combobox"
            aria-expanded="true"
            aria-controls="spice-command-results"
            aria-activedescendant={activeOptionId}
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>

        <div id="spice-command-results" className="command-palette__results" role="listbox">
          {filteredCommands.map((command, index) => (
            <button
              key={command.id}
              id={`spice-command-option-${command.id}`}
              type="button"
              tabIndex={-1}
              role="option"
              aria-selected={effectiveSelectedIndex === index}
              className={`command-palette__item ${effectiveSelectedIndex === index ? 'is-selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => {
                command.run();
                closePalette();
              }}
            >
              <span>
                <strong>{command.label}</strong>
                {command.description && <small>{command.description}</small>}
              </span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          ))}

          {hasQuickSearch && (
            <button
              type="button"
              tabIndex={-1}
              id="spice-command-option-quick-search"
              role="option"
              aria-selected={effectiveSelectedIndex === filteredCommands.length}
              className={`command-palette__item command-palette__item--search ${effectiveSelectedIndex === filteredCommands.length ? 'is-selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(filteredCommands.length)}
              onClick={() => {
                onQuickSearch(query.trim());
                closePalette();
              }}
            >
              <span>
                <strong>Search for “{query.trim()}”</strong>
                <small>Open global Hybrid music search</small>
              </span>
              <kbd>Enter</kbd>
            </button>
          )}

          {resultCount === 0 && (
            <p className="command-palette__empty">No matching commands.</p>
          )}
        </div>

        <footer className="command-palette__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> run</span>
          <span>Global shortcut <kbd>Ctrl K</kbd></span>
        </footer>
      </section>
    </div>
  );
}
