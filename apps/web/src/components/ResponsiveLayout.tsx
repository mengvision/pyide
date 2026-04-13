/**
 * ResponsiveLayout — wraps the main IDE layout for browser viewport handling.
 *
 * Breakpoints:
 *   Desktop  (>1200px) : Full 4-panel layout — sidebar + editor + output + chat
 *   Tablet  (768-1200px): Collapsible sidebar; stacked output/chat
 *   Mobile   (<768px)  : Single panel with tab navigation bar at the bottom
 *
 * This component does NOT rewrite the AppLayout component (which lives in
 * @desktop). Instead it:
 *  1. Reads viewport size via useWindowSize
 *  2. Drives the existing uiStore toggles to collapse/expand panels
 *  3. Renders mobile tab navigation when needed
 *  4. Provides collapse-toggle buttons overlaid on panel edges
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useUiStore } from '@desktop/stores/uiStore';

// ── useWindowSize hook ────────────────────────────────────────────────────────

interface WindowSize {
  width: number;
  height: number;
}

function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    let raf: number;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return size;
}

// ── Breakpoints ───────────────────────────────────────────────────────────────

const BP_MOBILE = 768;
const BP_TABLET = 1200;

type LayoutMode = 'desktop' | 'tablet' | 'mobile';

function getLayoutMode(width: number): LayoutMode {
  if (width < BP_MOBILE) return 'mobile';
  if (width < BP_TABLET) return 'tablet';
  return 'desktop';
}

// ── Mobile tab bar ────────────────────────────────────────────────────────────

type MobileTab = 'editor' | 'files' | 'output' | 'chat';

const MOBILE_TABS: { id: MobileTab; label: string; icon: string }[] = [
  { id: 'files',  label: 'Files',  icon: '📁' },
  { id: 'editor', label: 'Editor', icon: '✏️' },
  { id: 'output', label: 'Output', icon: '▶' },
  { id: 'chat',   label: 'AI',     icon: '💬' },
];

// ── ResponsiveLayout ──────────────────────────────────────────────────────────

interface ResponsiveLayoutProps {
  children: ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const { width } = useWindowSize();
  const mode = getLayoutMode(width);

  const leftSidebarVisible    = useUiStore((s) => s.leftSidebarVisible);
  const rightPanelVisible     = useUiStore((s) => s.rightPanelVisible);
  const toggleLeftSidebar     = useUiStore((s) => s.toggleLeftSidebar);
  const toggleRightPanel      = useUiStore((s) => s.toggleRightPanel);
  const setActiveLeftPanel    = useUiStore((s) => s.setActiveLeftPanel);
  const setActiveRightTab     = useUiStore((s) => s.setActiveRightTab);

  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');

  // ── Auto-collapse panels when viewport shrinks ────────────────────────────

  useEffect(() => {
    if (mode === 'mobile') {
      // On mobile: hide both panels, show via tab selection
      if (leftSidebarVisible)  toggleLeftSidebar();
      if (rightPanelVisible)   toggleRightPanel();
    } else if (mode === 'tablet') {
      // On tablet: collapse right panel by default
      if (rightPanelVisible)   toggleRightPanel();
    }
    // Desktop: restore panels if they were collapsed by a previous breakpoint
    // We deliberately don't restore automatically — let the user control it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Mobile tab handler ────────────────────────────────────────────────────

  const handleMobileTab = useCallback(
    (tab: MobileTab) => {
      setMobileTab(tab);
      switch (tab) {
        case 'files':
          if (!leftSidebarVisible) toggleLeftSidebar();
          if (rightPanelVisible)   toggleRightPanel();
          setActiveLeftPanel('files');
          break;
        case 'output':
          if (leftSidebarVisible)  toggleLeftSidebar();
          if (!rightPanelVisible)  toggleRightPanel();
          setActiveRightTab('variables');
          break;
        case 'chat':
          if (leftSidebarVisible)  toggleLeftSidebar();
          if (!rightPanelVisible)  toggleRightPanel();
          setActiveRightTab('chat');
          break;
        case 'editor':
        default:
          if (leftSidebarVisible)  toggleLeftSidebar();
          if (rightPanelVisible)   toggleRightPanel();
          break;
      }
    },
    [
      leftSidebarVisible, rightPanelVisible,
      toggleLeftSidebar, toggleRightPanel,
      setActiveLeftPanel, setActiveRightTab,
    ],
  );

  return (
    <div
      className={`web-responsive-layout web-responsive-layout--${mode}`}
      style={containerStyle}
    >
      {/* Tablet / desktop sidebar toggle pill */}
      {mode !== 'mobile' && (
        <button
          className="web-responsive-layout__toggle web-responsive-layout__toggle--left"
          onClick={toggleLeftSidebar}
          title={leftSidebarVisible ? 'Hide sidebar (Ctrl+B)' : 'Show sidebar (Ctrl+B)'}
          aria-label={leftSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          style={leftToggleStyle(leftSidebarVisible)}
        >
          {leftSidebarVisible ? '‹' : '›'}
        </button>
      )}

      {/* Main content */}
      <div style={contentStyle}>{children}</div>

      {/* Tablet / desktop right-panel toggle pill */}
      {mode !== 'mobile' && (
        <button
          className="web-responsive-layout__toggle web-responsive-layout__toggle--right"
          onClick={toggleRightPanel}
          title={rightPanelVisible ? 'Hide right panel (Ctrl+J)' : 'Show right panel (Ctrl+J)'}
          aria-label={rightPanelVisible ? 'Hide right panel' : 'Show right panel'}
          style={rightToggleStyle(rightPanelVisible)}
        >
          {rightPanelVisible ? '›' : '‹'}
        </button>
      )}

      {/* Mobile bottom tab bar */}
      {mode === 'mobile' && (
        <nav style={mobileTabBarStyle} aria-label="Panel navigation">
          {MOBILE_TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => handleMobileTab(id)}
              style={mobileTabStyle(id === mobileTab)}
              aria-current={id === mobileTab ? 'page' : undefined}
            >
              <span style={{ fontSize: '18px' }}>{icon}</span>
              <span style={{ fontSize: '10px', marginTop: '2px' }}>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const TOGGLE_PILL_BASE: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 100,
  width: '18px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-tertiary, #2d2d30)',
  border: '1px solid var(--border, #3c3c3c)',
  borderRadius: '0 6px 6px 0',
  color: 'var(--text-secondary, #858585)',
  cursor: 'pointer',
  fontSize: '14px',
  padding: 0,
  lineHeight: 1,
  opacity: 0.6,
  transition: 'opacity 0.15s',
};

function leftToggleStyle(_visible: boolean): React.CSSProperties {
  return { ...TOGGLE_PILL_BASE, left: 0, borderRadius: '0 6px 6px 0' };
}

function rightToggleStyle(_visible: boolean): React.CSSProperties {
  return { ...TOGGLE_PILL_BASE, right: 0, borderRadius: '6px 0 0 6px' };
}

const mobileTabBarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  height: '56px',
  borderTop: '1px solid var(--border, #3c3c3c)',
  background: 'var(--bg-secondary, #252526)',
  flexShrink: 0,
};

function mobileTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    background: 'none',
    border: 'none',
    color: active ? 'var(--accent, #3b82f6)' : 'var(--text-secondary, #858585)',
    cursor: 'pointer',
    padding: '4px 0',
    fontSize: '12px',
    borderTop: active ? '2px solid var(--accent, #3b82f6)' : '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
  };
}
