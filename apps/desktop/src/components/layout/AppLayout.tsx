import { useCallback } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { TitleBar } from './TitleBar';
import { LeftSidebar } from './LeftSidebar';
import { RightPanel } from './RightPanel';
import { StatusBar } from './StatusBar';
import { ResizeHandle } from './ResizeHandle';
import { EditorPanel } from '../editor/EditorPanel';
import styles from './AppLayout.module.css';

const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 500;
const MIN_RIGHT_WIDTH = 200;
const MAX_RIGHT_WIDTH = 600;

interface AppLayoutProps {
  onLogout?: () => void;
}

export function AppLayout({ onLogout }: AppLayoutProps) {
  const {
    leftSidebarVisible,
    rightPanelVisible,
    leftSidebarWidth,
    rightPanelWidth,
    setLeftSidebarWidth,
    setRightPanelWidth,
  } = useUiStore();

  const handleLeftResize = useCallback(
    (delta: number) => {
      setLeftSidebarWidth(
        Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, leftSidebarWidth + delta)),
      );
    },
    [leftSidebarWidth, setLeftSidebarWidth],
  );

  const handleRightResize = useCallback(
    (delta: number) => {
      setRightPanelWidth(
        Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, rightPanelWidth - delta)),
      );
    },
    [rightPanelWidth, setRightPanelWidth],
  );

  return (
    <div className={styles.layout}>
      <TitleBar onLogout={onLogout} />

      <div className={styles.main}>
        {leftSidebarVisible && (
          <>
            <LeftSidebar />
            <ResizeHandle direction="vertical" onResize={handleLeftResize} />
          </>
        )}

        <div className={styles.editorZone}>
          <EditorPanel />
        </div>

        {rightPanelVisible && (
          <>
            <ResizeHandle direction="vertical" onResize={handleRightResize} />
            <RightPanel />
          </>
        )}
      </div>

      <StatusBar />
    </div>
  );
}
