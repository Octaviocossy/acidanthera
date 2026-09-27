import { useEffect, useRef } from 'react';
import type { ThemeName } from '@/services/settings.service';
import { useSettingsStore } from '@/stores/settings-store';

/** Runs `update` inside a View Transition where the webview has one, so the compositor crossfades a
 *  snapshot of the old theme into the new (the `::view-transition-*(root)` rules in `motion.css`),
 *  and runs it at once where it does not (spec decision 25). */
function withViewTransition(update: () => void): void {
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(update);
    return;
  }
  update();
}

/**
 * Applies the persisted appearance settings (#28), mounted once in `App.tsx`:
 * `settings.theme` → the `data-theme` attribute the token palettes key off
 * (`src/styles/tokens/colors.css`), and `settings.editorFont` → the `--editor-font`
 * variable the CM6 theme reads. Reactive: #29's dialog writes through
 * `useSettingsStore.updateSettings`, which sets the store optimistically, so changes
 * apply live without a restart.
 *
 * A theme **change** crossfades the whole window (spec decision 25). The flip runs inside
 * `document.startViewTransition`, so the compositor fades two snapshots and never interpolates the
 * thousands of syntax spans a CSS colour transition would. Every writer lands here: the *theme
 * toggle*, the settings dialog's Theme row, and a hand-edit of `settings.toml` through
 * `useConfigWatcher`. The **boot-time** apply never crossfades: it replaces the CSS default, not a
 * theme anyone was looking at. Reduce Motion is deliberately not consulted, because the crossfade
 * is a fade and fades survive it (decision 5). Keys typed during the snapshot land and show when it
 * ends (invariant 60).
 */
export function useApplyTheme() {
  const theme = useSettingsStore((state) => state.settings?.theme);
  const editorFont = useSettingsStore((state) => state.settings?.editorFont);
  // The theme most recently asked for; `null` until the boot-time apply. Every flip writes this
  // rather than its own closure's theme, so a superseded transition whose callback runs late can
  // never land an outdated theme. Comparing against it, not the DOM, also absorbs StrictMode's
  // second mount effect, even while a flip is still pending inside a transition.
  const requested = useRef<ThemeName | null>(null);

  useEffect(() => {
    // Until settings load, leave the attribute unset so the CSS default (dark) holds.
    if (!theme || requested.current === theme) return;
    const boot = requested.current === null;
    requested.current = theme;
    const flip = () => {
      if (requested.current !== null) document.documentElement.dataset.theme = requested.current;
    };
    if (boot) flip();
    else withViewTransition(flip);
  }, [theme]);

  useEffect(() => {
    if (!editorFont) return;
    // JSON.stringify quotes (and escapes) the family name; --font-mono stays as fallback.
    document.documentElement.style.setProperty('--editor-font', `${JSON.stringify(editorFont)}, var(--font-mono)`);
  }, [editorFont]);
}
