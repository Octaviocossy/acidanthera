import { displayPath } from '@/lib/vault/display-path';

/** Fixed character budget for paths in the fixed-width chat rail. */
export const MAX_TOOL_PATH_CHARS = 29;

/** Elides leading path segments so the filename stays visible. */
export function truncatePathStart(path: string, maxChars: number = MAX_TOOL_PATH_CHARS): string {
  if (path.length <= maxChars) return path;

  const segments = path.split('/');
  const name = segments[segments.length - 1];

  if (name.length + 2 > maxChars) return `…${name.slice(name.length - (maxChars - 1))}`;

  let kept = name;
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    const candidate = `${segments[index]}/${kept}`;
    if (candidate.length + 2 > maxChars) break;
    kept = candidate;
  }

  return `…/${kept}`;
}

/** Vault-relative inside the open vault, home-collapsed outside it, raw when neither applies. */
function presentPath(absolute: string, vaultRoot: string | null): string {
  if (vaultRoot !== null) {
    const root = vaultRoot.endsWith('/') ? vaultRoot.slice(0, -1) : vaultRoot;
    if (absolute.startsWith(`${root}/`)) return absolute.slice(root.length + 1);
  }

  return displayPath(absolute);
}

/** Returns the path or search pattern displayed beside a tool-call verb. */
export function toolCallPath(args: Record<string, unknown>, vaultRoot: string | null): string | undefined {
  if (typeof args.file_path === 'string') return truncatePathStart(presentPath(args.file_path, vaultRoot));
  if (typeof args.path === 'string') return truncatePathStart(presentPath(args.path, vaultRoot));
  if (typeof args.pattern === 'string') return args.pattern;

  return undefined;
}
