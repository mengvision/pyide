import { useState, useRef, useEffect, useCallback } from 'react';
import { useEnvStore } from '../../stores/envStore';
import { useKernelContext } from '../../contexts/KernelContext';
import styles from './EnvSelector.module.css';

interface CreateVenvFormProps {
  onConfirm: (name: string, pythonVersion: string) => void;
  onCancel: () => void;
}

function CreateVenvForm({ onConfirm, onCancel }: CreateVenvFormProps) {
  const [name, setName] = useState('');
  const [pythonVersion, setPythonVersion] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim(), pythonVersion.trim());
    }
  }

  return (
    <form className={styles.createForm} onSubmit={handleSubmit}>
      <p className={styles.createTitle}>New Environment</p>
      <input
        className={styles.createInput}
        type="text"
        placeholder="Name (e.g. ds-env)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        className={styles.createInput}
        type="text"
        placeholder="Python version (e.g. 3.11, optional)"
        value={pythonVersion}
        onChange={(e) => setPythonVersion(e.target.value)}
      />
      <div className={styles.createActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.confirmBtn} disabled={!name.trim()}>
          Create
        </button>
      </div>
    </form>
  );
}

interface EnvSelectorProps {
  /** Absolute path to the current project, used for refreshVenvs and createVenv.
   *  If omitted, create-venv is disabled. */
  projectPath?: string;
  onCreateVenv?: (name: string, pythonVersion: string) => Promise<void>;
}

export function EnvSelector({ projectPath, onCreateVenv }: EnvSelectorProps) {
  const venvs = useEnvStore((s) => s.venvs);
  const activeVenv = useEnvStore((s) => s.activeVenv);
  const setActiveVenv = useEnvStore((s) => s.setActiveVenv);

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Access kernel context to restart kernel when env changes
  let kernel: ReturnType<typeof useKernelContext> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    kernel = useKernelContext();
  } catch {
    // Outside KernelProvider – degrade gracefully
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selectVenv = useCallback(
    async (venv: typeof activeVenv) => {
      setActiveVenv(venv);
      setOpen(false);
      setShowCreate(false);

      // Restart kernel with the new Python path if a kernel context is available
      if (venv && kernel) {
        try {
          await kernel.stopKernel();
          await kernel.startKernel();
        } catch (err) {
          console.error('[EnvSelector] Failed to restart kernel:', err);
        }
      }
    },
    [setActiveVenv, kernel],
  );

  const handleCreateConfirm = useCallback(
    async (name: string, pythonVersion: string) => {
      if (onCreateVenv) {
        try {
          await onCreateVenv(name, pythonVersion);
        } catch (err) {
          console.error('[EnvSelector] Failed to create venv:', err);
        }
      }
      setShowCreate(false);
      setOpen(false);
    },
    [onCreateVenv],
  );

  const label = activeVenv
    ? `${activeVenv.name} (${activeVenv.pythonVersion.replace('Python ', '')})`
    : 'no env';

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={`${styles.trigger} ${open ? styles.triggerActive : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          setShowCreate(false);
        }}
        title="Select Python environment"
      >
        <span className={styles.envIcon}>⬡</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.caret}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {showCreate ? (
            <CreateVenvForm
              onConfirm={handleCreateConfirm}
              onCancel={() => setShowCreate(false)}
            />
          ) : (
            <>
              <div className={styles.dropdownHeader}>Python Environments</div>

              {venvs.length === 0 && (
                <div className={styles.emptyMsg}>No environments found</div>
              )}

              {venvs.map((venv) => (
                <button
                  key={venv.path}
                  className={`${styles.venvItem} ${activeVenv?.path === venv.path ? styles.venvItemActive : ''}`}
                  onClick={() => selectVenv(venv)}
                >
                  <span className={styles.venvName}>{venv.name}</span>
                  <span className={styles.venvPython}>
                    {venv.pythonVersion.replace('Python ', '')}
                  </span>
                  {activeVenv?.path === venv.path && (
                    <span className={styles.activeIndicator}>✓</span>
                  )}
                </button>
              ))}

              <div className={styles.divider} />

              <button
                className={styles.createBtn}
                onClick={() => setShowCreate(true)}
                disabled={!projectPath}
                title={!projectPath ? 'Open a project folder first' : 'Create new environment'}
              >
                + Create New...
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
