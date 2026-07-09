import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';

/**
 * Applies the persisted appearance settings (#28), mounted once in `App.tsx`:
 * `settings.theme` → the `data-theme` attribute the token palettes key off
 * (`src/styles/tokens/colors.css`), and `settings.editorFont` → the `--editor-font`
 * variable the CM6 theme reads. Reactive: #29's dialog writes through
 * `useSettingsStore.updateSettings`, which sets the store optimistically, so changes
 * apply live without a restart.
 */
export function useApplyTheme() {
  const theme = useSettingsStore((state) => state.settings?.theme);
  const editorFont = useSettingsStore((state) => state.settings?.editorFont);

  useEffect(() => {
    // Until settings load, leave the attribute unset so the CSS default (dark) holds.
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!editorFont) return;
    // JSON.stringify quotes (and escapes) the family name; --font-mono stays as fallback.
    document.documentElement.style.setProperty('--editor-font', `${JSON.stringify(editorFont)}, var(--font-mono)`);
  }, [editorFont]);
}
