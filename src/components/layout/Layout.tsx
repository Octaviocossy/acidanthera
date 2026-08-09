import { ChatPanel } from '@/components/layout/ChatPanel';
import { CommandBar } from '@/components/layout/CommandBar';
import { DeleteEntryDialog } from '@/components/layout/DeleteEntryDialog';
import { FileFinder } from '@/components/layout/FileFinder';
import { RenameEntryDialog } from '@/components/layout/RenameEntryDialog';
import { SettingsDialog } from '@/components/layout/SettingsDialog';
import { Sidebar } from '@/components/layout/Sidebar';
import { SwitchVaultDialog } from '@/components/layout/SwitchVaultDialog';
import { Titlebar } from '@/components/layout/Titlebar';
import { ToastHost } from '@/components/layout/ToastHost';
import { Viewer } from '@/components/layout/Viewer';
import { SidebarContextMenu } from '@/components/vault/SidebarContextMenu';
import { useModalKeymap } from '@/hooks/use-modal-keymap';

/**
 * The 3-region app shell (doc/v0-spec.md §5.0): sidebar, viewer, invocable chat, split view.
 * Owned by slice #10 — siblings only replace their own placeholder region file.
 */
export function Layout() {
  useModalKeymap();

  return (
    <div className="flex h-screen w-screen flex-col bg-canvas text-text-primary">
      <Titlebar />
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar />
        <Viewer />
        <ChatPanel />
        <CommandBar />
        <FileFinder />
        <SidebarContextMenu />
        {/* Before ToastHost so toasts stay visible above the modal scrim. */}
        <SettingsDialog />
        <SwitchVaultDialog />
        <DeleteEntryDialog />
        <RenameEntryDialog />
        <ToastHost />
      </div>
    </div>
  );
}
