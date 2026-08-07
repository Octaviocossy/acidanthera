import { StreamLanguage } from '@codemirror/language';
import { toml } from '@codemirror/legacy-modes/mode/toml';

/** TOML highlighting for config buffers (`settings.toml` / `keymaps.toml`, #100) — a legacy
 *  `StreamParser` wrapped as a CM6 `Language`, since CodeMirror has no first-party TOML mode. */
export const tomlLanguage = StreamLanguage.define(toml);
