import { type CM5RangeInterface, type CodeMirrorV, type OperatorArgs, type Pos, Vim } from '@replit/codemirror-vim';
import { clipboardService } from '@/services/clipboard.service';
import { useToastStore } from '@/stores/toast-store';

function cursorMin(...positions: Pos[]): Pos {
  return positions.reduce((earliest, position) => (position.line < earliest.line || (position.line === earliest.line && position.ch < earliest.ch) ? position : earliest));
}

function systemYank(cm: CodeMirrorV, args: OperatorArgs, _ranges: CM5RangeInterface[], oldAnchor: Pos): Pos {
  const vim = cm.state.vim;
  const text = cm.getSelection();

  Vim.getRegisterController().pushText(args.registerName, 'yank', text, args.linewise, vim.visualBlock);

  if (!vim.visualMode || vim.visualLine) {
    void clipboardService.writeText(text).then(
      () => useToastStore.getState().showToast('Yanked to clipboard'),
      (err: unknown) => useToastStore.getState().showToast(`Yank failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    );
  }

  return vim.visualMode ? cursorMin(vim.sel.anchor, vim.sel.head) : oldAnchor;
}

Vim.defineOperator('systemYank', systemYank);
Vim.mapCommand('y', 'operator', 'systemYank', {}, {});
