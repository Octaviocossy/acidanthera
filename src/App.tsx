import { Layout } from '@/components/layout/Layout';
import { useGlobalKeymap } from '@/hooks/use-global-keymap';
import { useSaveLoop } from '@/hooks/use-save-loop';

function App() {
  useGlobalKeymap();
  useSaveLoop();

  return <Layout />;
}

export default App;
