/** True when `target` is a text-input surface that owns its own keystrokes (shared by the global and sidebar keymaps). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // The raw attribute is read alongside `isContentEditable` because jsdom implements neither
  // `isContentEditable` nor the `contentEditable` property — without it a test would see
  // CodeMirror's content DOM as a plain non-editable target and diverge from the real app. In a
  // browser `isContentEditable` is already true there, so this check is redundant at runtime.
  return target.isContentEditable || target.getAttribute('contenteditable') === 'true' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}
