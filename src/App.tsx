import { Layout } from '@/components/layout/Layout';
import { useApplyTheme } from '@/hooks/use-apply-theme';
import { useGlobalKeymap } from '@/hooks/use-global-keymap';
import { useSaveLoop } from '@/hooks/use-save-loop';
import { useSettingsBootstrap } from '@/hooks/use-settings-bootstrap';

function App() {
  useGlobalKeymap();
  useSaveLoop();
  useSettingsBootstrap();
  useApplyTheme();

  return <Layout />;
}

export default App;
