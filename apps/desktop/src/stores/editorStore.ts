import { create } from 'zustand';

export interface FileTab {
  id: string;
  name: string;
  path: string;
  content: string;
  isDirty: boolean;
}

export interface CellInfo {
  index: number;
  title: string;
  startLine: number;
  endLine: number;
  code: string;
}

interface EditorState {
  files: FileTab[];
  activeFileId: string | null;
  cells: CellInfo[];
  currentCellIndex: number;

  openFile: (file: Omit<FileTab, 'isDirty'>) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  setCells: (cells: CellInfo[]) => void;
  setCurrentCellIndex: (index: number) => void;
  markFileSaved: (id: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  files: [],
  activeFileId: null,
  cells: [],
  currentCellIndex: 0,

  openFile: (file) =>
    set((state) => {
      // If file is already open, just activate it
      const existing = state.files.find((f) => f.id === file.id);
      if (existing) {
        return { activeFileId: file.id };
      }
      return {
        files: [...state.files, { ...file, isDirty: false }],
        activeFileId: file.id,
      };
    }),

  closeFile: (id) =>
    set((state) => {
      const newFiles = state.files.filter((f) => f.id !== id);
      let newActiveId = state.activeFileId;
      if (state.activeFileId === id) {
        // Activate the previous file or the next one
        const idx = state.files.findIndex((f) => f.id === id);
        if (newFiles.length === 0) {
          newActiveId = null;
        } else if (idx > 0) {
          newActiveId = newFiles[idx - 1].id;
        } else {
          newActiveId = newFiles[0].id;
        }
      }
      return { files: newFiles, activeFileId: newActiveId };
    }),

  setActiveFile: (id) =>
    set(() => ({ activeFileId: id })),

  updateFileContent: (id, content) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, content, isDirty: true } : f,
      ),
    })),

  setCells: (cells) => set(() => ({ cells })),

  setCurrentCellIndex: (index) => set(() => ({ currentCellIndex: index })),

  markFileSaved: (id) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, isDirty: false } : f,
      ),
    })),
}));
