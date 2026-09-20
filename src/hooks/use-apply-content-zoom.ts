import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';

/** Content-zoom bounds (ADR 0132 / #171), mirroring `CONTENT_ZOOM_MIN`/`MAX` in
 *  `src-tauri/src/settings.rs`. */
export const CONTENT_ZOOM_MIN = 0.8;
export const CONTENT_ZOOM_MAX = 1.6;

/** Clamps to `[CONTENT_ZOOM_MIN, CONTENT_ZOOM_MAX]` — the frontend is not the only writer of
 *  `settings.toml`, since a hand-edited file reaches this store through the config-dir watcher. */
export function clampContentZoom(value: number): number {
  return Math.min(CONTENT_ZOOM_MAX, Math.max(CONTENT_ZOOM_MIN, value));
}

/**
 * Applies the persisted content-zoom level (#171), mounted once in `App.tsx` beside
 * `useApplyTheme`: `settings.contentZoom` -> the `--content-scale` variable the scoped content
 * ladder reads (`src/styles/tokens/typography.css`). Reactive: `SettingsDialog`'s controls write
 * through `useSettingsStore.updateSettings`, which sets the store optimistically, so a change
 * applies live without a restart.
 */
export function useApplyContentZoom() {
  const contentZoom = useSettingsStore((state) => state.settings?.contentZoom);

  useEffect(() => {
    // Until settings load, leave the variable unset so the CSS default (1) holds.
    if (contentZoom === undefined) return;
    document.documentElement.style.setProperty('--content-scale', String(clampContentZoom(contentZoom)));
  }, [contentZoom]);
}
