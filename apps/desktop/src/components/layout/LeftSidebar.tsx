import { useUiStore } from '../../stores/uiStore';
import { FileTree } from '../sidebar/FileTree';
import { SkillsPanel } from '../sidebar/SkillsPanel';
import { MCPPanel } from '../sidebar/MCPPanel';
import { MemoryPanel } from '../sidebar/MemoryPanel';
import styles from './LeftSidebar.module.css';

type ActivityItem = {
  id: 'files' | 'skills' | 'mcp' | 'memory';
  icon: string;
  label: string;
};

const ACTIVITY_ITEMS: ActivityItem[] = [
  { id: 'files', icon: '📁', label: 'Files' },
  { id: 'skills', icon: '⚡', label: 'Skills' },
  { id: 'mcp', icon: '🔌', label: 'MCP' },
  { id: 'memory', icon: '🧠', label: 'Memory' },
];

const PANEL_TITLES: Record<string, string> = {
  files: 'File Explorer',
  skills: 'Skills',
  mcp: 'MCP',
  memory: 'Memory',
};

export function LeftSidebar() {
  const { leftSidebarWidth, activeLeftPanel, setActiveLeftPanel, workspacePath } = useUiStore();

  return (
    <div className={styles.sidebar} style={{ width: leftSidebarWidth }}>
      <div className={styles.activityBar}>
        {ACTIVITY_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.activityBtn} ${activeLeftPanel === item.id ? styles.active : ''}`}
            title={item.label}
            onClick={() => setActiveLeftPanel(item.id)}
          >
            {item.icon}
          </button>
        ))}
      </div>

      <div className={styles.contentPanel}>
        {activeLeftPanel !== 'files' && (
          <div className={styles.panelHeader}>
            {PANEL_TITLES[activeLeftPanel] ?? activeLeftPanel}
          </div>
        )}
        <div className={styles.panelBody}>
          {activeLeftPanel === 'files' && <FileTree rootPath={workspacePath} />}
          {activeLeftPanel === 'skills' && <SkillsPanel />}
          {activeLeftPanel === 'mcp' && <MCPPanel />}
          {activeLeftPanel === 'memory' && <MemoryPanel />}
        </div>
      </div>
    </div>
  );
}
