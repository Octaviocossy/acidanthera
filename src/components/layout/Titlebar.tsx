import { useAppStore } from '@/stores/app-store';

export function Titlebar() {
  const vaultName = useAppStore((state) => state.vaultRoot?.split('/').filter(Boolean).pop());

  return (
    <header data-tauri-drag-region className="flex h-[var(--rail-titlebar)] shrink-0 items-center border-b border-hairline bg-surface pl-[78px]">
      <div className="flex flex-1 items-center justify-center font-sans font-medium text-ui text-text-primary">
        <span>orbit</span>
        {vaultName && (
          <>
            <span> — </span>
            <span className="font-mono text-meta text-text-muted">{vaultName}</span>
          </>
        )}
      </div>
    </header>
  );
}
