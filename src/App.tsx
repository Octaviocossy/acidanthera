import { Layout } from '@/components/layout/Layout';
import { useGlobalKeymap } from '@/hooks/use-global-keymap';

function App() {
  useGlobalKeymap();

  return <Layout />;
}

export default App;
