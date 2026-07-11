import { useEffect, useMemo, useRef } from 'react';
import { getModel } from '@/lib/agent/model-catalog';
import { deriveChatTitle, parseChatFile } from '@/lib/chat/chat-file';
import { cn } from '@/lib/utils';
import type { ChatRecord } from '@/services/chats.service';
import { useAppStore } from '@/stores/app-store';
import { useChatHistoryStore } from '@/stores/chat-history-store';
import { useChatStore } from '@/stores/chat-store';

/** A saved chat reduced to what the row shows — parsed once per record (not on every render). */
interface HistoryRowVM {
  id: string;
  title: string;
  modelLabel: string;
  updatedMs: number;
}

/** Parses one `ChatRecord` for display; a corrupt file degrades to its id rather than vanishing. */
function toRowVM(record: ChatRecord): HistoryRowVM {
  const result = parseChatFile(record.contents);
  if (!result.ok) {
    return { id: record.id, title: record.id, modelLabel: '—', updatedMs: record.updatedMs };
  }
  const { meta, items } = result.file;
  return {
    id: record.id,
    title: meta.title || deriveChatTitle(items),
    modelLabel: getModel(meta.model)?.label ?? meta.model ?? '—',
    updatedMs: record.updatedMs,
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A compact "updated" label: just now / `Nm` / `Nh` / `Nd`, then the locale date past a week. */
function formatRelative(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(ms).toLocaleDateString();
}

/**
 * The chat panel's History tab (#71, epic #66): a keyboard-navigable list of the conversations saved
 * under `.orbit/chats/`. The sibling of the sidebar's tree view — cursor state lives in
 * `useChatHistoryStore`, `j`/`k`/`l`/`Enter` in `useChatHistoryKeymap`, and this component is the
 * presentational list. It refreshes on mount (it is only mounted while the History tab is shown), and
 * a row click opens the chat into the transcript (which switches back to the Chat tab).
 */
export function ChatHistoryList() {
  const records = useChatHistoryStore((state) => state.records);
  const cursorId = useChatHistoryStore((state) => state.cursorId);
  const loading = useChatHistoryStore((state) => state.loading);
  const refresh = useChatHistoryStore((state) => state.refresh);
  const open = useChatHistoryStore((state) => state.open);
  const setCursor = useChatHistoryStore((state) => state.setCursor);
  const activeChatId = useChatStore((state) => state.chatId);
  const focusRegion = useAppStore((state) => state.focusRegion);
  const listRef = useRef<HTMLDivElement>(null);

  // Refresh whenever the History tab is shown — this list only mounts while `tab === 'history'`,
  // so a remount-driven fetch always reflects the latest saves without a watcher subscription.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the cursored row on screen as `j`/`k` walks the list.
  useEffect(() => {
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursorId]);

  const rows = useMemo(() => records.map(toRowVM), [records]);
  const now = Date.now();

  if (loading && rows.length === 0) {
    return <p className="px-4 py-3 font-mono text-text-faint text-xs uppercase tracking-caps">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="px-4 py-3 font-mono text-text-faint text-xs uppercase tracking-caps">No saved chats yet.</p>;
  }

  return (
    <div ref={listRef} role="listbox" aria-label="Saved chats" className="flex flex-col py-1">
      {rows.map((row) => {
        const isCursor = row.id === cursorId;
        const isActive = row.id === activeChatId;
        return (
          // biome-ignore lint/a11y/useFocusableInteractive: keyboard interaction is region-scoped via useChatHistoryKeymap (window-level, vim-style), not per-row DOM focus.
          // biome-ignore lint/a11y/useKeyWithClickEvents: same as above — onClick is a mouse affordance alongside the keyboard path, not a replacement for it.
          <div
            key={row.id}
            role="option"
            aria-selected={isActive}
            data-cursor={isCursor}
            onClick={() => {
              focusRegion('chat');
              setCursor(row.id);
              open(row.id);
            }}
            className={cn('relative flex cursor-pointer select-none flex-col gap-0.5 px-4 py-2 text-sm', isActive ? 'bg-surface-2 text-text' : 'text-text-dim hover:text-text')}
          >
            {isCursor && <span className="absolute inset-y-0 left-0 w-0.5 bg-border-active" aria-hidden="true" />}
            <span className="truncate font-sans">{row.title}</span>
            <span className="truncate font-mono text-text-faint text-xs">
              {row.modelLabel} · {formatRelative(row.updatedMs, now)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
