/**
 * useStatePreservation — persist and restore critical UI state via sessionStorage.
 *
 * What is preserved:
 *   - Open files list (id, name, path, content, isDirty)
 *   - Active file/tab ID
 *   - Active left panel selection
 *   - Active right tab selection
 *   - Panel visibility (left sidebar, right panel)
 *   - Panel widths / output panel height
 *
 * What is NOT preserved:
 *   - Auth tokens (those live in localStorage via the platform auth service)
 *   - Kernel / execution state (too complex to serialise reliably)
 *   - Editor scroll positions (complex DOM-coupled state)
 *
 * Saves are debounced (500 ms) so rapid store mutations don't cause
 * excessive serialisation work.
 *
 * Usage:
 *   Call `useStatePreservation()` once near the root of the authenticated
 *   part of the app. It returns `{ restored }` — a boolean that is `true`
 *   once the initial restore attempt is complete.
 */

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@desktop/stores/editorStore';
import { useUiStore }     from '@desktop/stores/uiStore';
import type { FileTab }   from '@desktop/stores/editorStore';

const SESSION_KEY = 'pyide_web_ui_state';
const DEBOUNCE_MS = 500;

// ── Snapshot shape ────────────────────────────────────────────────────────────

interface UiSnapshot {
  version: 1;
  activeFileId: string | null;
  files: FileTab[];
  activeLeftPanel: string;
  activeRightTab: string;
  leftSidebarVisible: boolean;
  rightPanelVisible: boolean;
  leftSidebarWidth: number;
  rightPanelWidth: number;
  outputPanelHeight: number;
}

// ── Serialise ─────────────────────────────────────────────────────────────────

function buildSnapshot(): UiSnapshot {
  const ed = useEditorStore.getState();
  const ui = useUiStore.getState();
  return {
    version: 1,
    activeFileId:        ed.activeFileId,
    files:               ed.files,
    activeLeftPanel:     ui.activeLeftPanel,
    activeRightTab:      ui.activeRightTab,
    leftSidebarVisible:  ui.leftSidebarVisible,
    rightPanelVisible:   ui.rightPanelVisible,
    leftSidebarWidth:    ui.leftSidebarWidth,
    rightPanelWidth:     ui.rightPanelWidth,
    outputPanelHeight:   ui.outputPanelHeight,
  };
}

function saveSnapshot(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(buildSnapshot()));
  } catch {
    // sessionStorage may be unavailable (private browsing quota, etc.)
  }
}

// ── Deserialise ───────────────────────────────────────────────────────────────

function loadSnapshot(): UiSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UiSnapshot;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function applySnapshot(snapshot: UiSnapshot): void {
  const edActions = useEditorStore.getState();
  const uiActions = useUiStore.getState();

  // Restore open files
  if (Array.isArray(snapshot.files)) {
    snapshot.files.forEach((f) => {
      edActions.openFile({ id: f.id, name: f.name, path: f.path, content: f.content });
    });
  }

  // Restore active file
  if (snapshot.activeFileId) {
    edActions.setActiveFile(snapshot.activeFileId);
  }

  // Restore UI panel state
  if (snapshot.activeLeftPanel) {
    uiActions.setActiveLeftPanel(snapshot.activeLeftPanel as Parameters<typeof uiActions.setActiveLeftPanel>[0]);
  }
  if (snapshot.activeRightTab) {
    uiActions.setActiveRightTab(snapshot.activeRightTab as Parameters<typeof uiActions.setActiveRightTab>[0]);
  }

  // Panel sizes
  if (typeof snapshot.leftSidebarWidth === 'number') {
    uiActions.setLeftSidebarWidth(snapshot.leftSidebarWidth);
  }
  if (typeof snapshot.rightPanelWidth === 'number') {
    uiActions.setRightPanelWidth(snapshot.rightPanelWidth);
  }
  if (typeof snapshot.outputPanelHeight === 'number') {
    uiActions.setOutputPanelHeight(snapshot.outputPanelHeight);
  }

  // Panel visibility (only override store defaults when explicitly stored)
  if (typeof snapshot.leftSidebarVisible === 'boolean') {
    if (snapshot.leftSidebarVisible !== uiActions.leftSidebarVisible) {
      uiActions.toggleLeftSidebar();
    }
  }
  if (typeof snapshot.rightPanelVisible === 'boolean') {
    if (snapshot.rightPanelVisible !== uiActions.rightPanelVisible) {
      uiActions.toggleRightPanel();
    }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseStatePreservationReturn {
  /** True once the initial restore attempt has completed. */
  restored: boolean;
}

export function useStatePreservation(): UseStatePreservationReturn {
  const [restored, setRestored] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Restore on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const snapshot = loadSnapshot();
    if (snapshot) {
      try {
        applySnapshot(snapshot);
      } catch (err) {
        console.warn('[useStatePreservation] Failed to restore state:', err);
      }
    }
    setRestored(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Subscribe to store changes and debounce-save ────────────────────────
  useEffect(() => {
    const scheduleFlush = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(saveSnapshot, DEBOUNCE_MS);
    };

    // Subscribe to both stores — unsubscribe on cleanup
    const unsubEditor = useEditorStore.subscribe(scheduleFlush);
    const unsubUi     = useUiStore.subscribe(scheduleFlush);

    return () => {
      unsubEditor();
      unsubUi();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Flush immediately before page unload ───────────────────────────────
  useEffect(() => {
    const onBeforeUnload = () => saveSnapshot();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return { restored };
}
