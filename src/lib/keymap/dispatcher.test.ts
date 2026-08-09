import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseChord } from './chord';
import { createDispatcher, type DispatcherCommand, type DispatcherKeyboardEvent, type DispatcherLayer } from './dispatcher';

function keyEvent(overrides: Partial<Pick<DispatcherKeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'target'>>): DispatcherKeyboardEvent {
  return {
    key: '',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

function command(id: string, chordSource: string, run: () => void): DispatcherCommand {
  return { id, chords: [parseChord(chordSource)], run };
}

describe('createDispatcher', () => {
  it('dispatches a single-step chord and prevents the default action', () => {
    const run = vi.fn();
    const layer: DispatcherLayer = { name: 'global', commands: [command('global.find-file', 'ctrl-p', run)], isActive: () => true };
    const dispatcher = createDispatcher([layer]);

    const event = keyEvent({ key: 'p', ctrlKey: true });
    const handled = dispatcher.handleKeyDown(event);

    expect(handled).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('dispatches a multi-step chord across two keydowns', () => {
    const run = vi.fn();
    const layer: DispatcherLayer = { name: 'global', commands: [command('global.find-file', 'ctrl-w f', run)], isActive: () => true };
    const dispatcher = createDispatcher([layer]);

    const first = dispatcher.handleKeyDown(keyEvent({ key: 'w', ctrlKey: true }));
    expect(first).toBe(true);
    expect(dispatcher.isPending()).toBe(true);
    expect(run).not.toHaveBeenCalled();

    const second = dispatcher.handleKeyDown(keyEvent({ key: 'f' }));
    expect(second).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(dispatcher.isPending()).toBe(false);
  });

  it('disarms a pending sequence when the next key does not continue it', () => {
    const run = vi.fn();
    const layer: DispatcherLayer = { name: 'global', commands: [command('global.find-file', 'ctrl-w f', run)], isActive: () => true };
    const dispatcher = createDispatcher([layer]);

    dispatcher.handleKeyDown(keyEvent({ key: 'w', ctrlKey: true }));
    const handled = dispatcher.handleKeyDown(keyEvent({ key: 'z' }));

    expect(handled).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(dispatcher.isPending()).toBe(false);
  });

  it('does not match anything for a target that owns its own keystrokes', () => {
    const run = vi.fn();
    const layer: DispatcherLayer = { name: 'global', commands: [command('global.find-file', 'ctrl-p', run)], isActive: () => true };
    const dispatcher = createDispatcher([layer]);
    const input = document.createElement('input');

    const handled = dispatcher.handleKeyDown(keyEvent({ key: 'p', ctrlKey: true, target: input }));

    expect(handled).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('gives the higher-precedence active layer the chord with no fallthrough to a lower layer', () => {
    const sidebarRun = vi.fn();
    const globalRun = vi.fn();
    const sidebar: DispatcherLayer = { name: 'sidebar', commands: [command('sidebar.cursor-down', 'j', sidebarRun)], isActive: () => true };
    const global: DispatcherLayer = { name: 'global', commands: [command('global.some-command', 'j', globalRun)], isActive: () => true };
    const dispatcher = createDispatcher([sidebar, global]);

    dispatcher.handleKeyDown(keyEvent({ key: 'j' }));

    expect(sidebarRun).toHaveBeenCalledTimes(1);
    expect(globalRun).not.toHaveBeenCalled();
  });

  it('falls through to the next layer only when the higher-precedence layer is inactive', () => {
    const sidebarRun = vi.fn();
    const globalRun = vi.fn();
    const sidebar: DispatcherLayer = { name: 'sidebar', commands: [command('sidebar.cursor-down', 'j', sidebarRun)], isActive: () => false };
    const global: DispatcherLayer = { name: 'global', commands: [command('global.some-command', 'j', globalRun)], isActive: () => true };
    const dispatcher = createDispatcher([sidebar, global]);

    dispatcher.handleKeyDown(keyEvent({ key: 'j' }));

    expect(sidebarRun).not.toHaveBeenCalled();
    expect(globalRun).toHaveBeenCalledTimes(1);
  });

  it('falls through to the next layer when the higher-precedence layer has no binding for the key at all', () => {
    const sidebarRun = vi.fn();
    const globalRun = vi.fn();
    const sidebar: DispatcherLayer = { name: 'sidebar', commands: [command('sidebar.cursor-down', 'j', sidebarRun)], isActive: () => true };
    const global: DispatcherLayer = { name: 'global', commands: [command('global.toggle-settings', 'ctrl-w s', globalRun)], isActive: () => true };
    const dispatcher = createDispatcher([sidebar, global]);

    dispatcher.handleKeyDown(keyEvent({ key: 'w', ctrlKey: true }));
    dispatcher.handleKeyDown(keyEvent({ key: 's' }));

    expect(sidebarRun).not.toHaveBeenCalled();
    expect(globalRun).toHaveBeenCalledTimes(1);
  });

  it('has unchanged fallthrough behavior when no swallowing layer is active', () => {
    const lowerRun = vi.fn();
    const modal: DispatcherLayer = { name: 'modal', commands: [], isActive: () => false, swallows: true };
    const lower: DispatcherLayer = { name: 'global', commands: [command('global.some-command', 'j', lowerRun)], isActive: () => true };
    const dispatcher = createDispatcher([modal, lower]);

    const handled = dispatcher.handleKeyDown(keyEvent({ key: 'j' }));

    expect(handled).toBe(true);
    expect(lowerRun).toHaveBeenCalledTimes(1);
  });

  it('absorbs an unmatched key in an active swallowing layer', () => {
    const lowerRun = vi.fn();
    const modal: DispatcherLayer = { name: 'modal', commands: [], isActive: () => true, swallows: true };
    const lower: DispatcherLayer = { name: 'sidebar', commands: [command('sidebar.cursor-down', 'j', lowerRun)], isActive: () => true };
    const dispatcher = createDispatcher([modal, lower]);
    const event = keyEvent({ key: 'j' });

    const handled = dispatcher.handleKeyDown(event);

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(lowerRun).not.toHaveBeenCalled();
  });

  it('dispatches a matched chord in an active swallowing layer', () => {
    const modalRun = vi.fn();
    const lowerRun = vi.fn();
    const modal: DispatcherLayer = { name: 'modal', commands: [command('modal.cancel', 'escape', modalRun)], isActive: () => true, swallows: true };
    const lower: DispatcherLayer = { name: 'global', commands: [command('global.some-command', 'escape', lowerRun)], isActive: () => true };
    const dispatcher = createDispatcher([modal, lower]);

    const handled = dispatcher.handleKeyDown(keyEvent({ key: 'Escape' }));

    expect(handled).toBe(true);
    expect(modalRun).toHaveBeenCalledTimes(1);
    expect(lowerRun).not.toHaveBeenCalled();
  });

  it('does not swallow when the swallowing layer is inactive', () => {
    const lowerRun = vi.fn();
    const modal: DispatcherLayer = { name: 'modal', commands: [], isActive: () => false, swallows: true };
    const lower: DispatcherLayer = { name: 'sidebar', commands: [command('sidebar.cursor-down', 'j', lowerRun)], isActive: () => true };
    const dispatcher = createDispatcher([modal, lower]);

    const handled = dispatcher.handleKeyDown(keyEvent({ key: 'j' }));

    expect(handled).toBe(true);
    expect(lowerRun).toHaveBeenCalledTimes(1);
  });

  it('disarms a lower-layer pending sequence when a swallowing layer becomes active', () => {
    const sidebarRun = vi.fn();
    let modalActive = false;
    const modal: DispatcherLayer = { name: 'modal', commands: [], isActive: () => modalActive, swallows: true };
    const sidebar: DispatcherLayer = { name: 'sidebar', commands: [command('sidebar.delete', 'd d', sidebarRun)], isActive: () => true };
    const dispatcher = createDispatcher([modal, sidebar]);

    dispatcher.handleKeyDown(keyEvent({ key: 'd' }));
    expect(dispatcher.isPending()).toBe(true);

    modalActive = true;
    const completion = keyEvent({ key: 'd' });
    const handled = dispatcher.handleKeyDown(completion);

    expect(handled).toBe(true);
    expect(dispatcher.isPending()).toBe(false);
    expect(completion.preventDefault).toHaveBeenCalledTimes(1);
    expect(sidebarRun).not.toHaveBeenCalled();
  });

  it('does not fall through mid-sequence when the committed layer goes inactive before the sequence completes', () => {
    const run = vi.fn();
    let active = true;
    const layer: DispatcherLayer = { name: 'global', commands: [command('global.find-file', 'ctrl-w f', run)], isActive: () => active };
    const dispatcher = createDispatcher([layer]);

    dispatcher.handleKeyDown(keyEvent({ key: 'w', ctrlKey: true }));
    active = false;
    const handled = dispatcher.handleKeyDown(keyEvent({ key: 'f' }));

    expect(handled).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('createDispatcher pending-sequence timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disarms a pending sequence once the timeout elapses', () => {
    const run = vi.fn();
    const layer: DispatcherLayer = { name: 'global', commands: [command('global.find-file', 'ctrl-w f', run)], isActive: () => true };
    const dispatcher = createDispatcher([layer], { timeoutMs: 1500 });

    dispatcher.handleKeyDown(keyEvent({ key: 'w', ctrlKey: true }));
    expect(dispatcher.isPending()).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(dispatcher.isPending()).toBe(false);

    const handled = dispatcher.handleKeyDown(keyEvent({ key: 'f' }));
    expect(handled).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('does not disarm before the timeout elapses', () => {
    const run = vi.fn();
    const layer: DispatcherLayer = { name: 'global', commands: [command('global.find-file', 'ctrl-w f', run)], isActive: () => true };
    const dispatcher = createDispatcher([layer], { timeoutMs: 1500 });

    dispatcher.handleKeyDown(keyEvent({ key: 'w', ctrlKey: true }));
    vi.advanceTimersByTime(1400);

    const handled = dispatcher.handleKeyDown(keyEvent({ key: 'f' }));
    expect(handled).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
