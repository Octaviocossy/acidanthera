import { create } from 'zustand';
import { type ConfigFileName, type ConfigParseDiagnostic, configService } from '@/services/config.service';

/** One config file's in-memory state: raw text in, parsed value + diagnostics out. `diagnostics`
 *  holds the Rust syntax diagnostic (if any) today; it stays an array so a later slice can append
 *  TS-side semantic diagnostics (spec decision 25: syntax errors reject in Rust, semantic errors
 *  degrade per key in TS) without changing this shape. */
interface ConfigFileState {
  raw: string;
  value: unknown;
  diagnostics: ConfigParseDiagnostic[];
}

interface ConfigState {
  /** Loaded config files, keyed by name. Empty until {@link load} is called — no consumers are
   *  wired to this store in this slice. */
  files: Partial<Record<ConfigFileName, ConfigFileState>>;
  /** Reads and parses `name`, replacing its entry in {@link files}. */
  load: (name: ConfigFileName) => Promise<void>;
}

/**
 * Raw text and parsed state for the two config files (`settings.toml`, `keymaps.toml`), backed
 * by `configService`. Holds no UI state and dispatches no toasts — those belong to whichever
 * consumer (settings, keymap catalog) wires this store up.
 */
export const useConfigStore = create<ConfigState>((set) => ({
  files: {},

  load: async (name) => {
    const raw = await configService.readConfigFile(name);
    const result = await configService.parseConfigFile(name);
    const fileState: ConfigFileState = result.kind === 'parsed' ? { raw, value: result.value, diagnostics: [] } : { raw, value: null, diagnostics: [result.diagnostic] };
    set((state) => ({ files: { ...state.files, [name]: fileState } }));
  },
}));
