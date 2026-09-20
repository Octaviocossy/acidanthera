import { Layout } from '@/components/layout/Layout';
import { useApplyContentZoom } from '@/hooks/use-apply-content-zoom';
import { useApplyTheme } from '@/hooks/use-apply-theme';
import { useConfigWatcher } from '@/hooks/use-config-watcher';
import { useGlobalKeymap } from '@/hooks/use-global-keymap';
import { useSaveLoop } from '@/hooks/use-save-loop';
import { useSettingsBootstrap } from '@/hooks/use-settings-bootstrap';
import { useViewerKeymap } from '@/hooks/use-viewer-keymap';

function App() {
  useGlobalKeymap();
  useViewerKeymap();
  useSaveLoop();
  useSettingsBootstrap();
  useConfigWatcher();
  useApplyTheme();
  useApplyContentZoom();

  return <Layout />;
}

export default App;
