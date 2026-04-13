import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useFileSystem } from './useFileSystem';

export function useSaveFile() {
  const { writeTextFile } = useFileSystem();
  const { files, activeFileId, markFileSaved } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!activeFileId) return;

        const activeFile = files.find((f) => f.id === activeFileId);
        if (!activeFile || !activeFile.path) return;

        try {
          await writeTextFile(activeFile.path, activeFile.content);
          markFileSaved(activeFile.id);
        } catch (err) {
          console.error('Failed to save file:', err);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, files, writeTextFile, markFileSaved]);
}
