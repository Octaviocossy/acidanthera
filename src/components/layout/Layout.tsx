import { AiFab } from '@/components/ai/AiFab';
import { ChatPanel } from '@/components/layout/ChatPanel';
import { CommandBar } from '@/components/layout/CommandBar';
import { FileFinder } from '@/components/layout/FileFinder';
import { SettingsDialog } from '@/components/layout/SettingsDialog';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { SwitchVaultDialog } from '@/components/layout/SwitchVaultDialog';
import { ToastHost } from '@/components/layout/ToastHost';
import { Viewer } from '@/components/layout/Viewer';

/**
 * The 3-region app shell (doc/v0-spec.md §5.0): sidebar, viewer, invocable chat, split view.
 * Owned by slice #10 — siblings only replace their own placeholder region file.
 */
export function Layout() {
  return (
    <div className="flex h-screen w-screen flex-col bg-bg text-text">
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar />
        <Viewer />
        <ChatPanel />
        <CommandBar />
        <AiFab />
        <FileFinder />
        {/* Before ToastHost so toasts stay visible above the modal scrim. */}
        <SettingsDialog />
        <SwitchVaultDialog />
        <ToastHost />
      </div>
      <StatusBar />
    </div>
  );
}
