/**
 * FileUpload component
 *
 * Renders a drag-and-drop zone that lets users upload local files to the
 * server workspace. Falls back to a native file picker button.
 *
 * Usage:
 *   <FileUpload destDir="/workspace/my-project" token="..." />
 */

import { useRef, useState, useCallback } from 'react';
import type { UploadProgress } from '../services/fileApi';
import { uploadFile } from '../services/fileApi';
import './FileUpload.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadEntry {
  name: string;
  progress: number; // 0–100
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

interface FileUploadProps {
  /** Destination directory path on the server. */
  destDir: string;
  /** JWT bearer token. */
  token: string;
  /** Called after all files have been uploaded (success or not). */
  onDone?: () => void;
  /** Called when upload(s) complete successfully; useful to trigger refresh. */
  onSuccess?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FileUpload({ destDir, token, onDone, onSuccess }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // ── Internal helpers ────────────────────────────────────────────────────

  const updateEntry = useCallback((name: string, patch: Partial<UploadEntry>) => {
    setUploads((prev) =>
      prev.map((e) => (e.name === name ? { ...e, ...patch } : e)),
    );
  }, []);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      // Initialise upload entries
      const initial: UploadEntry[] = files.map((f) => ({
        name: f.name,
        progress: 0,
        status: 'pending',
      }));
      setUploads(initial);
      setIsUploading(true);

      let anySuccess = false;

      for (const file of files) {
        updateEntry(file.name, { status: 'uploading' });
        try {
          await uploadFile(token, file, `${destDir}/${file.name}`, (p: UploadProgress) => {
            const pct = p.total > 0 ? Math.round((p.loaded / p.total) * 100) : 0;
            updateEntry(file.name, { progress: pct });
          });
          updateEntry(file.name, { status: 'done', progress: 100 });
          anySuccess = true;
        } catch (err) {
          updateEntry(file.name, {
            status: 'error',
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      }

      setIsUploading(false);
      if (anySuccess) onSuccess?.();
      onDone?.();
    },
    [token, destDir, updateEntry, onSuccess, onDone],
  );

  // ── Drag-and-drop handlers ──────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files).catch(console.error);
    }
  };

  // ── File input handler ─────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files).catch(console.error);
      // Reset so the same file can be re-selected
      e.target.value = '';
    }
  };

  const handleZoneClick = () => {
    if (!isUploading) inputRef.current?.click();
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="file-upload">
      {/* Drop zone */}
      <div
        className={`file-upload__zone ${isDragOver ? 'file-upload__zone--over' : ''} ${isUploading ? 'file-upload__zone--busy' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
        role="button"
        tabIndex={0}
        aria-label="Upload files — drag and drop or click to browse"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleZoneClick(); }}
      >
        <span className="file-upload__icon" aria-hidden>⬆</span>
        <span className="file-upload__label">
          {isUploading
            ? 'Uploading…'
            : 'Drop files here or click to upload'}
        </span>
        <span className="file-upload__dest">→ {destDir}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="file-upload__input"
          onChange={handleInputChange}
          tabIndex={-1}
          aria-hidden
        />
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <ul className="file-upload__list" aria-label="Upload progress">
          {uploads.map((entry) => (
            <li
              key={entry.name}
              className={`file-upload__item file-upload__item--${entry.status}`}
            >
              <span className="file-upload__item-icon" aria-hidden>
                {entry.status === 'done'
                  ? '✓'
                  : entry.status === 'error'
                  ? '✗'
                  : entry.status === 'uploading'
                  ? '⟳'
                  : '○'}
              </span>
              <span className="file-upload__item-name" title={entry.name}>
                {entry.name}
              </span>
              {entry.status === 'uploading' && (
                <div className="file-upload__bar-wrap" role="progressbar" aria-valuenow={entry.progress} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="file-upload__bar"
                    style={{ width: `${entry.progress}%` }}
                  />
                </div>
              )}
              {entry.status === 'error' && (
                <span className="file-upload__error" title={entry.errorMessage}>
                  {entry.errorMessage}
                </span>
              )}
              {entry.status === 'done' && (
                <span className="file-upload__done-pct">100%</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
