import { AnimatePresence, animate, type MotionValue, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, FilePlus, FileText, Folder, FolderPlus, Icon, Moon, Search, Settings, Sun } from '@/components/ui/icon';
import { Kbd } from '@/components/ui/kbd';
import { SectionLabel } from '@/components/ui/section-label';
import { TooltipHint } from '@/components/ui/tooltip-hint';
import { AnimatedTreeRow } from '@/components/vault/AnimatedTreeRow';
import { EntryDraftRow } from '@/components/vault/EntryDraftRow';
import { FileTreeItem } from '@/components/vault/FileTreeItem';
import { AcidantheraMarkGlyph } from '@/components/vault/glyphs';
import { InlineNameInput } from '@/components/vault/InlineNameInput';
import { useSidebarKeymap } from '@/hooks/use-sidebar-keymap';
import { executeAppCommand } from '@/lib/app-command';
import { canGoBack, canGoForward } from '@/lib/editor/navigation-history';
import { formatChord } from '@/lib/keymap/format-chord';
import { PANEL_CLOSE, PANEL_OPEN } from '@/lib/layout/panel-motion';
import { RAIL_WIDTH, sidebarRenderedWidth, usePanelWidths } from '@/lib/layout/panel-widths';
import { type FacePresence, sequencedFacePresence } from '@/lib/motion/presence-props';
import { useExitPhase } from '@/lib/motion/use-exit-phase';
import { tooltipTarget } from '@/lib/tooltip/tooltip-overlay';
import { cn } from '@/lib/utils';
import { createVaultEntry, draftPlacement } from '@/lib/vault/create-entry';
import { displayPath } from '@/lib/vault/display-path';
import { flattenVisibleTree, treeVaultRoot } from '@/lib/vault/flatten-tree';
import { countNotes } from '@/lib/vault/note-count';
import { openVaultFile } from '@/lib/vault/open-file';
import { pickAndPersistVault } from '@/lib/vault/pick-vault';
import { renameVaultEntry } from '@/lib/vault/rename-entry';
import { startNoteDraft } from '@/lib/vault/start-draft';
import { type VaultEntry, vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useContextMenuStore } from '@/stores/context-menu-store';
import { activeEditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSettingsStore } from '@/stores/settings-store';
import { type EntryDraft, useSidebarStore } from '@/stores/sidebar-store';

/**
 * The sidebar's *chrome strip*: the drag region the native traffic lights sit on (decisions 16,
 * 31). A separate strip gives the drag region the whole row rather than the gap between a mark
 * and two icons, and at 40px collapsed it is the only thing left to grab.
 *
 * It carries **no state** and only controls acting on what the window is currently showing (ADR
 * 0123, amending ADR 0121's blanket "no controls" — invariant 23). Anything app-level stays in
 * the sidebar proper, which is what keeps the strip from drifting back into a titlebar one
 * convenience at a time. Children stay clickable through Tauri's clickable-tag exemption, exactly
 * as `EditorTabs`' chips do — the drag attribute never goes on a button.
 *
 * `trafficLightPosition` is unchanged — the band is still 40px, so `y: 21.5` still centres them.
 */
function SidebarChromeStrip({ children }: { children?: React.ReactNode }) {
  return (
    <div data-tauri-drag-region="deep" className="flex h-[var(--rail-titlebar)] w-full shrink-0 items-center justify-end gap-0.5 px-[14px]">
      {children}
    </div>
  );
}

/**
 * The *navigation history* controls: back and forward over **buffer activations**, the first
 * controls the *chrome strip* has ever carried (ADR 0123).
 *
 * `ArrowLeft`/`ArrowRight` rather than chevrons (decision 38): `ChevronLeft` is already the
 * collapse toggle ~40px below in the brand row, and two identical glyphs meaning different things
 * in one 224px column is a misclick waiting to happen.
 *
 * **Pointer-only** (decision 36): no `AppCommandId`, so no chord and no `Kbd` — deliberately
 * against `doc/v0-spec.md` §5.5, and reversible by adding two command ids. Not mirrored onto the
 * *sidebar rail* (decision 33): a navigation control with no visible destination does not earn a
 * tooltip-identified 40px glyph.
 */
function NavigationHistoryControls() {
  const history = useEditorStore((state) => state.history);
  const goBack = useEditorStore((state) => state.goBack);
  const goForward = useEditorStore((state) => state.goForward);

  return (
    <>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Back" disabled={!canGoBack(history)} {...tooltipTarget('Back')} onClick={goBack}>
        <Icon icon={ArrowLeft} size={15} />
      </Button>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Forward" disabled={!canGoForward(history)} {...tooltipTarget('Forward')} onClick={goForward}>
        <Icon icon={ArrowRight} size={15} />
      </Button>
    </>
  );
}

/**
 * The *theme toggle*, in the *footer identity block*'s right slot and mirrored as the *sidebar
 * rail*'s bottom pin (decisions 31, 33) — one implementation, two mounts, so the pair cannot drift.
 *
 * It writes through the same `useSettingsStore.updateSettings` the *settings dialog*'s `Segmented`
 * calls: one write path with two call sites, so ADR 0101 keeps `settings.toml` authoritative and
 * the *settings dialog write* preserves comments and key order. Its icon states the **current**
 * theme, never the destination. Disabled while a `Syntax` diagnostic is present, exactly as the
 * dialog's rows are — `updateSettings` refuses that write anyway, so the click would silently do
 * nothing — and before the boot-time load resolves, where it also draws **no icon at all**:
 * `settings` is `null` until then, so there is no current theme, and defaulting to `Sun` would
 * state the dark one — wrongly, for anyone whose persisted theme is light. The button stays
 * mounted at its fixed 24px either way, so neither mount's layout shifts as settings arrive.
 */
function ThemeToggle({ className }: { className?: string }) {
  const settings = useSettingsStore((state) => state.settings);
  const diagnostics = useSettingsStore((state) => state.diagnostics);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const blocked = settings === null || diagnostics.some((diagnostic) => diagnostic.kind === 'syntax');

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-6 w-6 shrink-0 p-0', className)}
      aria-label="Toggle theme"
      disabled={blocked}
      {...tooltipTarget('Toggle theme')}
      onClick={() => {
        if (settings === null) return;
        void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
      }}
    >
      {settings !== null && <Icon icon={settings.theme === 'light' ? Moon : Sun} size={15} />}
    </Button>
  );
}

/**
 * A *primary nav* row: icon · label · its chord as a persistent unboxed `Kbd`.
 *
 * The one surface in the app that renders a chord in the layout rather than on hover, and still
 * never as a literal — `chord` comes from the resolved keymap (invariant 31). These are mouse
 * targets only: they are deliberately absent from `flattenVisibleTree` and the `j`/`k` cursor, so
 * the sidebar keeps its single row source.
 */
function NavRow({
  icon,
  label,
  chord,
  active = false,
  ariaPressed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  chord?: string;
  active?: boolean;
  ariaPressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={ariaPressed}
      className={cn(
        'flex w-full items-center gap-2 rounded-item px-2 py-[5px] text-left font-sans text-ui outline-none transition-colors duration-[var(--dur-fast)] ease-acidanthera hover:bg-hover focus-visible:ring-1 focus-visible:ring-border-strong',
        active ? 'bg-elevated text-text-primary' : 'text-text-secondary'
      )}
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
      {chord !== undefined && (
        <Kbd boxed={false} className="ml-auto shrink-0">
          {chord}
        </Kbd>
      )}
    </button>
  );
}

/** The explorer arrives as the sidebar expands and leaves as it collapses; the rail, the other way round. */
const EXPLORER_FACE = sequencedFacePresence('open', 'close');
const RAIL_FACE = sequencedFacePresence('close', 'open');

/**
 * One face of the sidebar — the explorer or the *sidebar rail* — as an `AnimatePresence` child. Both
 * faces are mounted while the aside's width tweens between them, and they swap **in sequence**
 * (motion-polish spec decision 1): the leaving face fades out over the first half of the tween and
 * the entering face fades in over the second, so no frame shows both. The leaving face is inert from
 * its first frame (invariant 60) and `aria-hidden`; the entering face is neither, so it takes keys
 * from frame 0 even while its pixels wait. A face that returns mid-exit fades back at once (decision 5).
 */
function SidebarLayer({ width, className, presence, children }: { width?: MotionValue; className?: string; presence: FacePresence; children: ReactNode }) {
  const { exiting, exitPhaseProps } = useExitPhase();
  // Once this face has begun leaving, coming back is a reversal: no sequencing wait (decision 5).
  // Set in a layout effect, before paint, so the re-entering render already reads it.
  const [returning, setReturning] = useState(false);
  useLayoutEffect(() => {
    if (exiting) setReturning(true);
  }, [exiting]);
  return (
    <motion.div
      className={cn('absolute inset-0', className)}
      style={{ width, ...exitPhaseProps.style }}
      inert={exitPhaseProps.inert}
      aria-hidden={exiting}
      initial={presence.initial}
      animate={returning ? { opacity: 1, transition: presence.reenter } : presence.animate}
      exit={presence.exit}
    >
      {children}
    </motion.div>
  );
}

const draftKeys = new WeakMap<EntryDraft, string>();
let draftSeq = 0;

/** One key per draft *instance*, since `beginDraft` builds a new object each time. With a fixed
 *  key, a draft restarted inside the last one's exit phase would re-enter that exiting instance:
 *  stale text, and no focus, because `InlineNameInput` focuses only on mount. */
function draftRowKey(draft: EntryDraft): string {
  let key = draftKeys.get(draft);
  if (key === undefined) {
    draftSeq += 1;
    key = `entry-draft-${draftSeq}`;
    draftKeys.set(draft, key);
  }
  return key;
}

/** Collapsible vault explorer — open/edit/save loop (doc/v0-spec.md §5.3, §6). Since the panel-motion
 *  slice (#180), the aside is permanent for the app's whole life (invariant 24): a collapse is a
 *  width tween of the shared `sidebarRenderedWidth`, its two faces — the explorer and the *sidebar
 *  rail* — swapping in sequence in an `AnimatePresence` while the width runs. */
export function Sidebar() {
  useSidebarKeymap();

  const sidebarExpanded = useAppStore((state) => state.sidebarExpanded);
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const agentOpen = useAppStore((state) => state.agentOpen);
  const toggleAgent = useAppStore((state) => state.toggleAgent);
  const openSettings = useAppStore((state) => state.openSettings);
  const focusRegion = useAppStore((state) => state.focusRegion);
  const collapseSidebar = useAppStore((state) => state.collapseSidebar);
  const expandSidebar = useAppStore((state) => state.expandSidebar);
  const showFileFinder = useFileFinderStore((state) => state.show);
  const showContextMenu = useContextMenuStore((state) => state.show);
  const globalBindings = useKeymapStore((state) => state.resolved.layers.global);
  const sidebarBindings = useKeymapStore((state) => state.resolved.layers.sidebar);

  const tree = useSidebarStore((state) => state.tree);
  const expanded = useSidebarStore((state) => state.expanded);
  const cursorPath = useSidebarStore((state) => state.cursorPath);
  const draft = useSidebarStore((state) => state.draft);
  const renamePath = useSidebarStore((state) => state.renamePath);
  const setTree = useSidebarStore((state) => state.setTree);
  const toggleExpanded = useSidebarStore((state) => state.toggleExpanded);
  const setCursor = useSidebarStore((state) => state.setCursor);
  const cancelDraft = useSidebarStore((state) => state.cancelDraft);
  const cancelRename = useSidebarStore((state) => state.cancelRename);

  const activeFilePath = useEditorStore((state) => activeEditorBuffer(state)?.filePath);
  const buffers = useEditorStore((state) => state.buffers);

  const panelWidths = usePanelWidths();
  const reduceMotion = useReducedMotion();
  const targetWidth = sidebarExpanded ? panelWidths.sidebar : RAIL_WIDTH;
  // Width is movement, so Reduce Motion drops it (decision 5); MotionConfig does not (spec Residual
  // Unknowns). A live drag follows the pointer 1:1 (decision 12). `jump` is the imperative
  // `transition: { duration: 0 }`: synchronous, and it stops any tween in flight.
  const instantWidth = reduceMotion === true || panelWidths.dragging === 'sidebar';
  // The explorer's own width: never narrower than its effective width, so a collapse clips fixed
  // content rather than re-wrapping it, yet it follows the aside down when a reset or a clamp
  // shrinks the sidebar while expanded.
  const explorerTarget = useMotionValue(panelWidths.sidebar);
  const explorerWidth = useTransform([sidebarRenderedWidth, explorerTarget], ([rendered, target]: number[]) => Math.max(rendered, target));
  const widthApplied = useRef(false);

  useLayoutEffect(() => {
    explorerTarget.jump(panelWidths.sidebar);
  }, [explorerTarget, panelWidths.sidebar]);

  useLayoutEffect(() => {
    // The first width is applied, never tweened: the initial render does not animate.
    if (!widthApplied.current || instantWidth) {
      widthApplied.current = true;
      sidebarRenderedWidth.jump(targetWidth);
      return;
    }
    // Expanding, or any width change while expanded, is an enter; collapsing is an exit. `animate`
    // starts from the current value, so a second toggle mid-tween reverses from where it is.
    const controls = animate(sidebarRenderedWidth, targetWidth, sidebarExpanded ? PANEL_OPEN : PANEL_CLOSE);
    return () => controls.stop();
  }, [targetWidth, instantWidth, sidebarExpanded]);

  useEffect(() => {
    if (vaultRoot === null) return;
    vaultService.readVaultTree().then(setTree);
  }, [vaultRoot, setTree]);

  useEffect(() => {
    const unlistenPromise = vaultService.onVaultChanged(() => {
      if (useAppStore.getState().vaultRoot === null) return;
      vaultService.readVaultTree().then(setTree);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setTree]);

  const vaultRows = flattenVisibleTree(tree, expanded);

  const findFileChord = formatChord(globalBindings.get('global.find-file'));
  const newNoteChord = formatChord(sidebarBindings.get('sidebar.new-note'));
  const newDirectoryChord = formatChord(sidebarBindings.get('sidebar.new-directory'));
  // `global`-layer, so unlike `a`/`Shift+A` beside it this chord is not focus-gated.
  const dailyNoteChord = formatChord(globalBindings.get('global.daily-note'));
  // The command id keeps its old name: `keymaps.toml` is user-visible, so the chat-to-agent
  // rename deliberately stopped at the wire (#143, spec decision 28).
  const agentChord = formatChord(globalBindings.get('global.toggle-chat'));
  const settingsChord = formatChord(globalBindings.get('global.toggle-settings'));

  /** The rail is a launcher, not a preview: files open in place; directories expand first. */
  const openRailEntry = (entry: VaultEntry) => {
    setCursor(entry.path);
    if (!entry.isDir) {
      openVaultFile(entry.path);
      return;
    }
    expandSidebar();
    if (!expanded.has(entry.path)) toggleExpanded(entry.path);
    focusRegion('sidebar');
  };

  const rowElements = vaultRows.map(({ entry, depth }) => {
    const child =
      entry.path === renamePath ? (
        <InlineNameInput
          depth={depth}
          initialValue={entry.isDir ? entry.name : entry.name.replace(/\.md$/, '')}
          placeholder={entry.isDir ? 'folder name' : 'note name'}
          ariaLabel={entry.isDir ? 'Rename folder' : 'Rename note'}
          icon={
            entry.isDir ? (
              <>
                <span className="opacity-65">
                  <Icon
                    icon={ChevronRight}
                    size={12}
                    className={cn('shrink-0 transition-transform duration-[var(--dur)] ease-acidanthera', expanded.has(entry.path) ? 'rotate-90' : '')}
                  />
                </span>
                <Icon icon={Folder} size={15} className="opacity-65" />
              </>
            ) : (
              <Icon icon={FileText} size={15} className="opacity-65" />
            )
          }
          onCommit={(name) => void renameVaultEntry(entry.path, name, entry.isDir)}
          onCancel={cancelRename}
        />
      ) : (
        <FileTreeItem
          label={entry.name}
          kind={entry.isDir ? 'dir' : 'file'}
          depth={depth}
          active={entry.path === activeFilePath}
          cursor={entry.path === cursorPath}
          changed={buffers.some((buffer) => buffer.filePath === entry.path && buffer.dirty)}
          collapsed={entry.isDir && !expanded.has(entry.path)}
          modified={entry.modified}
          // One meaning of a number in one panel: a folder's count and the footer's `N notes` are
          // the same `countNotes` measure at two scopes, both from the already-cached tree.
          noteCount={entry.isDir ? countNotes(entry.children ?? []) : undefined}
          onClick={() => {
            focusRegion('sidebar');
            setCursor(entry.path);
            if (entry.isDir) {
              toggleExpanded(entry.path);
            } else {
              openVaultFile(entry.path);
            }
          }}
          onContextMenu={(event) => {
            if (vaultRoot === null) return;
            event.preventDefault();
            focusRegion('sidebar');
            setCursor(entry.path);
            showContextMenu(event.clientX, event.clientY, entry.path);
          }}
        />
      );

    return <AnimatedTreeRow key={entry.path}>{child}</AnimatedTreeRow>;
  });

  if (draft !== null) {
    const { index, depth } = draftPlacement(vaultRows, draft);
    rowElements.splice(
      index,
      0,
      <AnimatedTreeRow key={draftRowKey(draft)}>
        <EntryDraftRow kind={draft.kind} depth={depth} onCommit={(name) => void createVaultEntry(draft, name)} onCancel={cancelDraft} />
      </AnimatedTreeRow>
    );
  }

  const vaultName = vaultRoot === null ? null : (vaultRoot.split('/').filter(Boolean).pop() ?? vaultRoot);
  const noteCount = countNotes(tree);

  return (
    // One <aside> for the app's whole life (invariant 24): a collapse swaps its face, never the
    // element, and its width *is* `sidebarRenderedWidth`. `relative overflow-hidden` is what lets
    // the explorer's own (possibly wider) face clip against it instead of reflowing.
    <motion.aside className="relative flex h-full shrink-0 flex-col overflow-hidden bg-panel" aria-label="Vault explorer" style={{ width: sidebarRenderedWidth }}>
      <AnimatePresence initial={false}>
        {sidebarExpanded ? (
          <SidebarLayer key="explorer" width={explorerWidth} className="flex h-full flex-col" presence={EXPLORER_FACE}>
            <SidebarChromeStrip>
              <NavigationHistoryControls />
            </SidebarChromeStrip>
            <div className="flex items-center justify-between gap-1 px-[14px] pb-2">
              <AcidantheraMarkGlyph className="text-text-secondary" />
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  aria-label="Find file"
                  {...tooltipTarget(<TooltipHint label="Find file" chord={findFileChord} />)}
                  aria-haspopup="dialog"
                  onClick={showFileFinder}
                >
                  <Icon icon={Search} size={15} />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Collapse sidebar" {...tooltipTarget('Collapse sidebar')} onClick={collapseSidebar}>
                  <Icon icon={ChevronLeft} size={15} />
                </Button>
                {/* Rehomed from the footer, whose right slot is the *theme toggle* now. ADR 0121 lets
                    that slot be reassigned but not vacated: Settings still needs a pointer affordance
                    in the expanded sidebar (decision 32). */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  aria-label="Settings"
                  {...tooltipTarget(<TooltipHint label="Settings" chord={settingsChord} />)}
                  aria-haspopup="dialog"
                  onClick={openSettings}
                >
                  <Icon icon={Settings} size={15} />
                </Button>
              </div>
            </div>
            <nav aria-label="Primary" className="flex shrink-0 flex-col gap-0.5 px-[10px] pb-3">
              {vaultRoot !== null && (
                <>
                  <NavRow icon={<Icon icon={FilePlus} size={15} className="shrink-0" />} label="New note" chord={newNoteChord} onClick={() => startNoteDraft('note')} />
                  {/* The two note-producing verbs adjacent, then the folder verb, then the agent. */}
                  <NavRow
                    icon={<Icon icon={CalendarDays} size={15} className="shrink-0" />}
                    label="Daily note"
                    chord={dailyNoteChord}
                    onClick={() => executeAppCommand('global.daily-note')}
                  />
                  <NavRow
                    icon={<Icon icon={FolderPlus} size={15} className="shrink-0" />}
                    label="New folder"
                    chord={newDirectoryChord}
                    onClick={() => startNoteDraft('directory')}
                  />
                </>
              )}
              <NavRow
                icon={
                  <span className="shrink-0 text-accent text-ui" aria-hidden="true">
                    ✦
                  </span>
                }
                label="Agent"
                chord={agentChord}
                active={agentOpen}
                ariaPressed={agentOpen}
                onClick={toggleAgent}
              />
            </nav>
            {vaultRoot === null ? (
              <div className="px-[14px]">
                <Button variant="secondary" size="sm" onClick={() => void pickAndPersistVault()}>
                  Open vault…
                </Button>
              </div>
            ) : (
              <>
                <SectionLabel className="shrink-0 px-[14px] pb-1">NOTES</SectionLabel>
                <div
                  role="tree"
                  aria-label="Notes"
                  className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[14px] pb-[14px]"
                  onContextMenu={(event) => {
                    if (vaultRoot === null || event.target !== event.currentTarget) return;
                    event.preventDefault();
                    showContextMenu(event.clientX, event.clientY, null);
                  }}
                >
                  {/* Not a row: absent from `flattenVisibleTree`, so `j`/`k` never land on it and it
                      carries no `treeitem` role. Suppressed while a draft is open, or naming the first
                      note would show the placeholder and the input at once (decision 29). */}
                  {vaultRows.length === 0 && draft === null ? (
                    <span className="font-sans text-ui text-text-secondary">Nothing here yet.</span>
                  ) : (
                    // Mounted only once rows exist, so the boot-time tree read paints without animating. Keyed on
                    // the vault the cached tree came from, so another vault's tree remounts it instead of
                    // collapsing one vault's rows while growing the next's (Out of Scope: wholesale replacement).
                    <AnimatePresence key={treeVaultRoot(tree)} initial={false}>
                      {rowElements}
                    </AnimatePresence>
                  )}
                </div>
              </>
            )}
            {vaultRoot !== null && (
              /* The *footer identity block*. The tile is `--bg-elevated`, never `--accent-soft`:
                 ADR 0122 exempts the mark itself, not a fill behind it. */
              <footer className="flex shrink-0 items-center gap-2 border-t border-hairline px-[14px] py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-item bg-elevated">
                  <AcidantheraMarkGlyph className="h-[18px] w-[16px] text-text-secondary" />
                </span>
                <span className="flex min-w-0 flex-col" {...tooltipTarget(displayPath(vaultRoot))}>
                  <span className="truncate font-sans text-ui text-text-primary">{vaultName}</span>
                  <span className="truncate font-mono text-meta text-text-muted">
                    {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                  </span>
                </span>
                <ThemeToggle className="ml-auto" />
              </footer>
            )}
          </SidebarLayer>
        ) : (
          <SidebarLayer key="rail" className="flex h-full w-[var(--rail-sidebar-collapsed)] flex-col items-center border-hairline" presence={RAIL_FACE}>
            <SidebarChromeStrip />
            <AcidantheraMarkGlyph className="text-text-secondary" />
            <div className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-2">
              <Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0" aria-label="Expand sidebar" {...tooltipTarget('Expand sidebar')} onClick={expandSidebar}>
                <Icon icon={ChevronRight} size={15} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0"
                aria-label="Find file"
                {...tooltipTarget(<TooltipHint label="Find file" chord={findFileChord} />)}
                aria-haspopup="dialog"
                onClick={showFileFinder}
              >
                <Icon icon={Search} size={15} />
              </Button>
              {vaultRoot !== null && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 p-0"
                    aria-label="New note"
                    {...tooltipTarget(<TooltipHint label="New note" chord={newNoteChord} />)}
                    onClick={() => startNoteDraft('note')}
                  >
                    <Icon icon={FilePlus} size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 p-0"
                    aria-label="New folder"
                    {...tooltipTarget(<TooltipHint label="New folder" chord={newDirectoryChord} />)}
                    onClick={() => startNoteDraft('directory')}
                  >
                    <Icon icon={FolderPlus} size={14} />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-6 w-6 shrink-0 p-0 text-accent', agentOpen && 'bg-elevated')}
                aria-pressed={agentOpen}
                aria-label={agentOpen ? 'Close AI agent' : 'Open AI agent'}
                {...tooltipTarget(<TooltipHint label="Agent" chord={agentChord} />)}
                onClick={toggleAgent}
              >
                <span className="text-ui" aria-hidden="true">
                  ✦
                </span>
              </Button>
              {/* A brand-row control now, so the rail carries it in the stack rather than pinned
                  (decision 33): the rail mirrors whatever the expanded sidebar's hidden surfaces
                  carry, and Settings is no longer one of the footer's. */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0"
                aria-label="Settings"
                {...tooltipTarget(<TooltipHint label="Settings" chord={settingsChord} />)}
                aria-haspopup="dialog"
                onClick={openSettings}
              >
                <Icon icon={Settings} size={15} />
              </Button>
              {vaultRoot !== null && tree.length > 0 && (
                <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
                  {tree.map((entry) => (
                    <Button
                      key={entry.path}
                      variant="ghost"
                      size="sm"
                      className={cn('h-6 w-6 shrink-0 p-0', entry.path === activeFilePath && 'bg-elevated text-text-primary')}
                      aria-label={entry.name}
                      {...tooltipTarget(entry.name)}
                      onClick={() => openRailEntry(entry)}
                    >
                      {entry.isDir ? <Icon icon={Folder} size={15} /> : <Icon icon={FileText} size={15} />}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            {/* Pinned outside the launcher column's scroll, standing in for the *footer identity
                block* the rail hides — so the pin holds whatever that footer's right slot holds,
                which is the *theme toggle* now (decision 33, invariant 24). */}
            <ThemeToggle className="mt-2 mb-3" />
          </SidebarLayer>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
