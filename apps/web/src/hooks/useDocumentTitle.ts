/**
 * useDocumentTitle — keep the browser tab title in sync with editor state.
 *
 * Title formats:
 *   No file open        → "PyIDE Web"
 *   File open           → "filename.py — PyIDE Web"
 *   Unsaved changes     → "● filename.py — PyIDE Web"
 *   Kernel busy         → "⟳ filename.py — PyIDE Web"
 *
 * Kernel busy takes precedence over unsaved-changes indicator.
 */

import { useEffect } from 'react';
import { useEditorStore } from '@desktop/stores/editorStore';

const APP_NAME = 'PyIDE Web';

/**
 * Reads from editorStore to determine the active file name and dirty state,
 * then writes `document.title` on every relevant change.
 *
 * @param isKernelBusy - pass `true` while a kernel execution is in flight
 */
export function useDocumentTitle(isKernelBusy = false): void {
  const files        = useEditorStore((s) => s.files);
  const activeFileId = useEditorStore((s) => s.activeFileId);

  useEffect(() => {
    const activeFile = activeFileId
      ? files.find((f) => f.id === activeFileId)
      : null;

    if (!activeFile) {
      document.title = APP_NAME;
      return;
    }

    // Extract bare filename from full path (e.g. "/home/user/script.py" → "script.py")
    const filename = activeFile.name || activeFile.path.split('/').pop() || activeFile.path;

    let prefix = '';
    if (isKernelBusy) {
      prefix = '⟳ ';
    } else if (activeFile.isDirty) {
      prefix = '● ';
    }

    document.title = `${prefix}${filename} \u2014 ${APP_NAME}`;

    // Restore title on unmount
    return () => {
      document.title = APP_NAME;
    };
  }, [files, activeFileId, isKernelBusy]);
}
