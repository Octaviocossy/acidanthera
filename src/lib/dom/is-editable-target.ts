/** True when `target` is a text-input surface that owns its own keystrokes (shared by the global and sidebar keymaps). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}
