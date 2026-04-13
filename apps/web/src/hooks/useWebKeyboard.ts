/**
 * useWebKeyboard — browser-safe keyboard shortcut handler for PyIDE Web.
 *
 * Intercepts shortcuts that browsers handle by default and redirects them to
 * IDE actions. Must be registered at the App level so it captures events
 * before any individual component handler.
 *
 * Coexistence with CodeMirror: CodeMirror registers its own keydown listener
 * on its own DOM node. We listen on `window` with `capture: false` (default),
 * which means CodeMirror's handler fires first for events originating inside
 * the editor. We call `e.preventDefault()` for browser-level actions only
 * when the focused element is NOT inside a CodeMirror editor, so that
 * CodeMirror's own key bindings are never interrupted.
 *
 * The actual IDE logic (save, run cell, etc.) is dispatched via custom events
 * or via direct store/hook calls so this file stays free of business logic.
 */

import { useEffect } from 'react';
import { useUiStore } from '@desktop/stores/uiStore';

// Helper: true when focus is inside a CodeMirror editor instance
function isFocusedInCodeMirror(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('.cm-editor') !== null;
}

// Helper: true when focus is inside any interactive text input
function isFocusedInInput(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target as HTMLElement;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable
  );
}

/**
 * useWebKeyboard
 *
 * Wire up in your top-level component:
 *
 *   useWebKeyboard();
 *
 * Replace (or keep alongside) the desktop's `useGlobalKeyboard` + `useSaveFile`.
 * This hook supersedes browser defaults for the following keys:
 *
 *  Ctrl+S         → save file          (prevent browser "Save Page As")
 *  Ctrl+P         → open file picker   (prevent browser "Print")
 *  Ctrl+Shift+P   → command palette    (prevent browser "Print" in some shells)
 *  Ctrl+B         → toggle sidebar     (prevent browser "Bold" in rich inputs)
 *  Ctrl+/         → toggle comment     (no default, but just in case)
 *  Ctrl+Enter     → execute cell
 *  Shift+Enter    → execute cell + advance
 *  Escape         → cancel / close dialog (no default to prevent, but uniform)
 *  Ctrl+,         → open settings
 *  Ctrl+J         → toggle right panel
 *  Ctrl+L         → focus chat input
 */
export function useWebKeyboard(): void {
  const toggleLeftSidebar  = useUiStore((s) => s.toggleLeftSidebar);
  const toggleRightPanel   = useUiStore((s) => s.toggleRightPanel);
  const setActiveRightTab  = useUiStore((s) => s.setActiveRightTab);
  const openSettings       = useUiStore((s) => s.openSettings);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key   = e.key;
      const target = e.target;

      // ── Ctrl+S — Save file ────────────────────────────────────────────────
      // Always intercept regardless of focused element.
      if (ctrl && !shift && !e.altKey && key === 's') {
        e.preventDefault();
        // Dispatch a custom event that useSaveFile (or a dedicated web hook)
        // can listen to. This avoids duplicating save logic here.
        window.dispatchEvent(new Event('pyide:save-file'));
        return;
      }

      // ── Ctrl+P — Open quick-file-picker (prevent browser Print) ──────────
      if (ctrl && !shift && !e.altKey && key === 'p') {
        e.preventDefault();
        window.dispatchEvent(new Event('pyide:open-file-picker'));
        return;
      }

      // ── Ctrl+Shift+P — Command palette (prevent browser Print) ───────────
      if (ctrl && shift && !e.altKey && key === 'P') {
        e.preventDefault();
        window.dispatchEvent(new Event('pyide:command-palette'));
        return;
      }

      // ── Ctrl+, — Settings ─────────────────────────────────────────────────
      if (ctrl && !shift && !e.altKey && key === ',') {
        e.preventDefault();
        openSettings();
        return;
      }

      // ── From here, ignore shortcuts that are typed in regular text inputs ──
      // (CodeMirror manages its own shortcuts for Ctrl+Enter, etc.)
      if (isFocusedInInput(target)) return;

      // ── Ctrl+Enter — Execute current cell ────────────────────────────────
      if (ctrl && !shift && !e.altKey && key === 'Enter') {
        e.preventDefault();
        window.dispatchEvent(new Event('pyide:run-cell'));
        return;
      }

      // ── Shift+Enter — Execute cell and advance ───────────────────────────
      if (!ctrl && shift && !e.altKey && key === 'Enter') {
        // Only intercept when NOT in CodeMirror (CodeMirror handles it natively)
        if (!isFocusedInCodeMirror(target)) {
          e.preventDefault();
          window.dispatchEvent(new Event('pyide:run-cell-advance'));
        }
        return;
      }

      // ── Ctrl+B — Toggle sidebar (prevent browser Bold in inputs) ─────────
      if (ctrl && !shift && !e.altKey && key === 'b') {
        e.preventDefault();
        toggleLeftSidebar();
        return;
      }

      // ── Ctrl+J — Toggle right panel ───────────────────────────────────────
      if (ctrl && !shift && !e.altKey && key === 'j') {
        e.preventDefault();
        toggleRightPanel();
        return;
      }

      // ── Ctrl+L — Focus chat input ─────────────────────────────────────────
      if (ctrl && !shift && !e.altKey && key === 'l') {
        e.preventDefault();
        if (!useUiStore.getState().rightPanelVisible) {
          useUiStore.getState().toggleRightPanel();
        }
        setActiveRightTab('chat');
        setTimeout(() => {
          window.dispatchEvent(new Event('pyide:focus-chat-input'));
        }, 50);
        return;
      }

      // ── Ctrl+/ — Toggle comment ───────────────────────────────────────────
      if (ctrl && !shift && !e.altKey && key === '/') {
        e.preventDefault();
        window.dispatchEvent(new Event('pyide:toggle-comment'));
        return;
      }

      // ── Escape — Cancel / close dialog ───────────────────────────────────
      if (!ctrl && !shift && !e.altKey && key === 'Escape') {
        window.dispatchEvent(new Event('pyide:escape'));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLeftSidebar, toggleRightPanel, setActiveRightTab, openSettings]);
}
