# Plan: Epic — Settings, theme, line numbers & toast feedback

> Status: **completed**
> Created: 2026-07-09
> Updated: 2026-07-10
> Issue: #24

## Goal

User-configurable settings — agent engine, editor font, dark/light theme, and vault path (defaulting to `~/Documents/orbit-brain`) — behind a settings dialog, plus an editor line-number gutter and toast feedback for file saves.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #25 | `25-settings-foundation` | feat: persisted settings store + default vault bootstrap | merged |
| 1 | #26 | `26-editor-line-numbers` | feat: editor line numbers | merged |
| 1 | #27 | `27-toast-notifications` | feat: toast notifications for save feedback | merged |
| 2 | #28 | `28-theme-editor-font` | feat: apply theme & editor font settings | merged |
| 2 | #29 | `29-settings-dialog` | feat: settings dialog | merged |

## Dependency Edges

```
28 -> 25
28 -> 26
29 -> 25
```
