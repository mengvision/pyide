import { usePlatform } from '@pyide/platform';
import type { FileEntry } from '@pyide/platform';

export type { FileEntry };

export function useFileSystem() {
  const platform = usePlatform();

  const readDirectory = (path: string): Promise<FileEntry[]> =>
    platform.file.readDirectory(path, false);

  const readDirectoryRecursive = (path: string, maxDepth: number = 3): Promise<FileEntry[]> =>
    platform.file.readDirectory(path, true, maxDepth);

  const readTextFile = (path: string): Promise<string> =>
    platform.file.read(path);

  const writeTextFile = (path: string, content: string): Promise<void> =>
    platform.file.write(path, content);

  const createFile = (path: string): Promise<void> =>
    platform.file.createFile(path);

  const createDirectory = (path: string): Promise<void> =>
    platform.file.createDirectory(path);

  const renameItem = (oldPath: string, newPath: string): Promise<void> =>
    platform.file.rename(oldPath, newPath);

  const deleteItem = (path: string): Promise<void> =>
    platform.file.delete(path);

  const pickFolder = (): Promise<string | null> =>
    platform.file.pickFolder();

  return {
    readDirectory,
    readDirectoryRecursive,
    readTextFile,
    writeTextFile,
    createFile,
    createDirectory,
    renameItem,
    deleteItem,
    pickFolder,
  };
}
