import { CONFIG_ENTRIES } from '@/lib/config/config-entries';
import type { VaultEntry } from '@/services/vault.service';

/** A searchable file, either a Markdown note from the current vault tree or a config file
 *  (#100). `source` routes finder selection instead of re-deriving it from `path`. */
export interface VaultFileCandidate {
  path: string;
  relativePath: string;
  name: string;
  source: 'vault' | 'config';
}

/** Collects note files recursively without regard to the sidebar's expanded directories. */
export function collectVaultFiles(tree: readonly VaultEntry[], vaultRoot: string): VaultFileCandidate[] {
  const root = vaultRoot.endsWith('/') ? vaultRoot.slice(0, -1) : vaultRoot;
  const candidates: VaultFileCandidate[] = [];

  for (const entry of tree) {
    if (entry.isDir) {
      if (entry.children !== null) candidates.push(...collectVaultFiles(entry.children, root));
      continue;
    }

    if (entry.path.startsWith(`${root}/`)) {
      candidates.push({ path: entry.path, relativePath: entry.path.slice(root.length + 1), name: entry.name, source: 'vault' });
    }
  }

  return candidates;
}

/** The two config files, unioned into the finder's candidate list alongside vault notes. They
 *  bypass {@link collectVaultFiles}'s vault-root prefix filter entirely — they live outside the
 *  vault (ADR 0004) — and get a synthetic `config/`-prefixed path so they read as distinct from
 *  a real vault note at a glance. */
export function collectConfigCandidates(): VaultFileCandidate[] {
  return CONFIG_ENTRIES.map((entry) => ({ path: entry.name, relativePath: `config/${entry.name}`, name: entry.label, source: 'config' as const }));
}

function score(candidate: VaultFileCandidate, query: string): number | null {
  const target = candidate.relativePath.toLowerCase();
  let queryIndex = 0;
  let previousMatch = -2;
  let total = 0;

  for (let index = 0; index < target.length && queryIndex < query.length; index += 1) {
    if (target[index] !== query[queryIndex]) continue;
    total += 1;
    if (index === previousMatch + 1) total += 4;
    if (index === 0 || target[index - 1] === '/') total += 3;
    previousMatch = index;
    queryIndex += 1;
  }

  return queryIndex === query.length ? total : null;
}

/** Ranks candidates by a deterministic, dependency-free subsequence match. */
export function rankVaultFiles(candidates: readonly VaultFileCandidate[], query: string, limit = 50): VaultFileCandidate[] {
  const normalizedQuery = query.trim().toLowerCase();
  const ranked = candidates
    .map((candidate) => ({ candidate, score: normalizedQuery === '' ? 0 : score(candidate, normalizedQuery) }))
    .filter((result): result is { candidate: VaultFileCandidate; score: number } => result.score !== null)
    .sort((left, right) => right.score - left.score || left.candidate.relativePath.localeCompare(right.candidate.relativePath));

  return ranked.slice(0, limit).map(({ candidate }) => candidate);
}
