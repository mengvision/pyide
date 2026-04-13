import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { SettingsSection } from './SettingsSection';
import { TextInput, ToggleSwitch, RadioGroup, NumberInput } from './FormControls';
import { SessionManager } from './SessionManager';
import styles from './SettingsDialog.module.css';

type NavSection = 'ai' | 'appearance' | 'editor' | 'shortcuts' | 'session';
type TestState = 'idle' | 'testing' | 'success' | 'error';

const NAV_ITEMS: { id: NavSection; label: string; icon: string }[] = [
  { id: 'ai',         label: 'AI Provider',  icon: '🤖' },
  { id: 'appearance', label: 'Appearance',   icon: '🎨' },
  { id: 'editor',     label: 'Editor',       icon: '✏️' },
  { id: 'shortcuts',  label: 'Shortcuts',    icon: '⌨️' },
  { id: 'session',    label: 'Session',      icon: '🔑' },
];

const THEME_OPTIONS = [
  { value: 'dark'   as const, label: 'Dark'   },
  { value: 'light'  as const, label: 'Light'  },
  { value: 'system' as const, label: 'System' },
];

const TAB_OPTIONS: { value: string; label: string }[] = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
];

const KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+,',            description: 'Open Settings' },
  { keys: 'Ctrl+B',            description: 'Toggle left sidebar' },
  { keys: 'Ctrl+J',            description: 'Toggle right panel' },
  { keys: 'Ctrl+L',            description: 'Focus AI chat input' },
  { keys: 'Ctrl+S',            description: 'Save file' },
  { keys: 'Shift+Enter',       description: 'Run cell & advance' },
  { keys: 'Ctrl+Shift+Enter',  description: 'Run current cell' },
  { keys: 'Ctrl+Enter',        description: 'Run selection / current line' },
];


export function SettingsDialog() {
  const closeSettings = useUiStore((s) => s.closeSettings);

  // Read current settings for draft initialization
  const storeSnapshot = useSettingsStore.getState();

  // Local draft state — only committed on Save
  const [activeSection, setActiveSection] = useState<NavSection>('ai');
  const [draft, setDraft] = useState({
    theme:    storeSnapshot.theme,
    vimMode:  storeSnapshot.vimMode,
    fontSize: storeSnapshot.fontSize,
    tabSize:  storeSnapshot.tabSize,
    wordWrap: storeSnapshot.wordWrap,
    minimap:  storeSnapshot.minimap,
    aiConfig: { ...storeSnapshot.aiConfig },
  });

  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState('');

  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset draft when dialog opens (sync from store)
  useEffect(() => {
    const s = useSettingsStore.getState();
    setDraft({
      theme:    s.theme,
      vimMode:  s.vimMode,
      fontSize: s.fontSize,
      tabSize:  s.tabSize,
      wordWrap: s.wordWrap,
      minimap:  s.minimap,
      aiConfig: { ...s.aiConfig },
    });
    setActiveSection('ai');
    setTestState('idle');
    setTestMessage('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSettings]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) closeSettings();
  }

  function patchAi(partial: Partial<typeof draft.aiConfig>) {
    setDraft((d) => ({ ...d, aiConfig: { ...d.aiConfig, ...partial } }));
  }

  async function handleSave() {
    // Apply all draft changes directly to store state
    useSettingsStore.setState({
      theme:    draft.theme,
      vimMode:  draft.vimMode,
      fontSize: draft.fontSize,
      tabSize:  draft.tabSize,
      wordWrap: draft.wordWrap,
      minimap:  draft.minimap,
      aiConfig: draft.aiConfig,
    });
    // Re-apply theme immediately
    const resolved =
      draft.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : draft.theme;
    document.documentElement.setAttribute('data-theme', resolved);

    await useSettingsStore.getState().saveSettings();
    closeSettings();
  }

  async function handleTestConnection() {
    setTestState('testing');
    setTestMessage('');
    try {
      const url = draft.aiConfig.baseUrl.replace(/\/$/, '') + '/models';
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${draft.aiConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        setTestState('success');
        setTestMessage('Connected successfully');
      } else {
        setTestState('error');
        setTestMessage(`HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      setTestState('error');
      setTestMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  const dialog = (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Settings</h2>
          <button className={styles.closeBtn} onClick={closeSettings} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Sidebar */}
          <nav className={styles.sidebar}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`${styles.navItem} ${activeSection === item.id ? styles.navItemActive : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className={styles.content}>
            {activeSection === 'ai' && (
              <SettingsSection
                title="AI Provider"
                description="Configure the OpenAI-compatible endpoint, credentials, and model."
              >
                <TextInput
                  label="Base URL"
                  value={draft.aiConfig.baseUrl}
                  onChange={(v) => patchAi({ baseUrl: v })}
                  placeholder="https://api.openai.com/v1"
                />
                <TextInput
                  label="API Key"
                  value={draft.aiConfig.apiKey}
                  onChange={(v) => patchAi({ apiKey: v })}
                  placeholder="sk-..."
                  type="password"
                />
                <TextInput
                  label="Model ID"
                  value={draft.aiConfig.modelId}
                  onChange={(v) => patchAi({ modelId: v })}
                  placeholder="gpt-4o"
                />
                <div className={styles.testRow}>
                  <button
                    type="button"
                    className={styles.btnTest}
                    onClick={handleTestConnection}
                    disabled={testState === 'testing' || !draft.aiConfig.baseUrl}
                  >
                    {testState === 'testing' ? 'Testing...' : 'Test Connection'}
                  </button>
                  {testState === 'testing' && (
                    <span className={`${styles.testStatus} ${styles.statusTesting}`}>⏳ Testing…</span>
                  )}
                  {testState === 'success' && (
                    <span className={`${styles.testStatus} ${styles.statusSuccess}`}>✅ {testMessage}</span>
                  )}
                  {testState === 'error' && (
                    <span className={`${styles.testStatus} ${styles.statusError}`}>❌ {testMessage}</span>
                  )}
                </div>
              </SettingsSection>
            )}

            {activeSection === 'appearance' && (
              <SettingsSection
                title="Appearance"
                description="Choose the application color theme."
              >
                <RadioGroup
                  label="Theme"
                  options={THEME_OPTIONS}
                  value={draft.theme}
                  onChange={(v) => setDraft((d) => ({ ...d, theme: v }))}
                />
              </SettingsSection>
            )}

            {activeSection === 'editor' && (
              <SettingsSection
                title="Editor"
                description="Customize the Monaco code editor behavior."
              >
                <ToggleSwitch
                  label="Vim Mode"
                  checked={draft.vimMode}
                  onChange={(v) => setDraft((d) => ({ ...d, vimMode: v }))}
                />
                <NumberInput
                  label="Font Size"
                  value={draft.fontSize}
                  onChange={(v) => setDraft((d) => ({ ...d, fontSize: v }))}
                  min={10}
                  max={24}
                />
                <RadioGroup
                  label="Tab Size"
                  options={TAB_OPTIONS}
                  value={String(draft.tabSize)}
                  onChange={(v) => setDraft((d) => ({ ...d, tabSize: Number(v) }))}
                />
                <ToggleSwitch
                  label="Word Wrap"
                  checked={draft.wordWrap}
                  onChange={(v) => setDraft((d) => ({ ...d, wordWrap: v }))}
                />
                <ToggleSwitch
                  label="Minimap"
                  checked={draft.minimap}
                  onChange={(v) => setDraft((d) => ({ ...d, minimap: v }))}
                />
              </SettingsSection>
            )}

            {activeSection === 'shortcuts' && (
              <SettingsSection
                title="Keyboard Shortcuts"
                description="Reference for built-in keyboard shortcuts. Customization coming soon."
              >
                <table className={styles.shortcutsTable}>
                  <thead>
                    <tr>
                      <th>Shortcut</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEYBOARD_SHORTCUTS.map((s) => (
                      <tr key={s.keys}>
                        <td><kbd className={styles.kbd}>{s.keys}</kbd></td>
                        <td>{s.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SettingsSection>
            )}

            {activeSection === 'session' && (
              <SettingsSection
                title="Session"
                description="View remote server connection status and manage your login session."
              >
                <SessionManager onLogout={closeSettings} />
              </SettingsSection>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={closeSettings}>
            Cancel
          </button>
          <button className={styles.btnSave} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
