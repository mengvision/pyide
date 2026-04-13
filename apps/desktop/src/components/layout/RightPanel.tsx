import { useUiStore } from '../../stores/uiStore';
import { VariablesPanel } from '../variables/VariablesPanel';
import { AIChatPanel } from '../chat/AIChatPanel';
import styles from './RightPanel.module.css';

type TabDef = {
  id: 'variables' | 'plots' | 'chat' | 'environment';
  label: string;
};

const TABS: TabDef[] = [
  { id: 'variables', label: 'Variables' },
  { id: 'plots', label: 'Plots' },
  { id: 'chat', label: 'AI Chat' },
  { id: 'environment', label: 'Environment' },
];

export function RightPanel() {
  const { rightPanelWidth, activeRightTab, setActiveRightTab } = useUiStore();

  return (
    <div className={styles.rightPanel} style={{ width: rightPanelWidth }}>
      <div className={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeRightTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveRightTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeRightTab === 'variables' && <VariablesPanel />}
        {activeRightTab === 'plots' && <span>Plots — coming soon</span>}
        {activeRightTab === 'chat' && <AIChatPanel />}
        {activeRightTab === 'environment' && <span>Environment — coming soon</span>}
      </div>
    </div>
  );
}
