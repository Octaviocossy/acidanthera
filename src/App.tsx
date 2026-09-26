import { MotionConfig } from 'motion/react';
import { Layout } from '@/components/layout/Layout';
import { useApplyContentZoom } from '@/hooks/use-apply-content-zoom';
import { useApplyTheme } from '@/hooks/use-apply-theme';
import { useConfigWatcher } from '@/hooks/use-config-watcher';
import { useGlobalKeymap } from '@/hooks/use-global-keymap';
import { useSaveLoop } from '@/hooks/use-save-loop';
import { useSettingsBootstrap } from '@/hooks/use-settings-bootstrap';
import { useViewerKeymap } from '@/hooks/use-viewer-keymap';
import { enterTransition } from '@/lib/motion/tokens';

function App() {
  useGlobalKeymap();
  useViewerKeymap();
  useSaveLoop();
  useSettingsBootstrap();
  useConfigWatcher();
  useApplyTheme();
  useApplyContentZoom();

  // `reducedMotion="user"` honours macOS Reduce Motion for every Motion component: transform and
  // layout animation go instant, fades stay (spec decision 5). A width tween or a scroll is NOT
  // covered by it and must read `useReducedMotion()` itself. The default transition means a
  // component that forgets its own falls back to a token, never Motion's default spring (decision 1).
  return (
    <MotionConfig reducedMotion="user" transition={enterTransition('base')}>
      <Layout />
    </MotionConfig>
  );
}

export default App;
