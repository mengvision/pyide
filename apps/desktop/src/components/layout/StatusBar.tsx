import { useState, useCallback } from 'react';
import { useKernelStore } from '../../stores/kernelStore';
import { useEnvStore } from '../../stores/envStore';
import { useChatStore } from '../../stores/chatStore';
import { useUiStore } from '../../stores/uiStore';
import { useKernel } from '../../hooks/useKernel';
import { EnvSelector } from '../statusbar/EnvSelector';
import { RemoteEnvSelector } from '../statusbar/RemoteEnvSelector';
import { useSettingsStore } from '../../stores/settingsStore';
import { MigrationDialog } from './MigrationDialog';
import {
  analyzeNamespace,
  classifyVariables,
  executeMigration,
  type MigrationReport,
} from '../../utils/stateMigration';
import styles from './StatusBar.module.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface DialogState {
  fromMode: 'local' | 'remote';
  toMode: 'local' | 'remote';
  report: MigrationReport;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StatusBar() {
  const connectionStatus = useKernelStore((s) => s.connectionStatus);
  const isExecuting = useKernelStore((s) => s.isExecuting);
  const activeVenv = useEnvStore((s) => s.activeVenv);
  const uvInstalled = useEnvStore((s) => s.uvInstalled);
  const sessionCost = useChatStore((s) => s.sessionCost);
  const kernelMode = useUiStore((s) => s.kernelMode);
  const setKernelMode = useUiStore((s) => s.setKernelMode);
  const workspacePath = useUiStore((s) => s.workspacePath);
  const serverUrl = useSettingsStore((s) => s.serverUrl);

  // The active kernel hook exposes both modes (Rules of Hooks); we use it to
  // call inspectAll on the *current* mode and executeCode on the *destination*.
  const kernel = useKernel();

  // Migration dialog state
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // ── Derive status display ───────────────────────────────────────────────

  let dotClass: string;
  let statusLabel: string;

  if (isExecuting) {
    dotClass = styles.executing;
    statusLabel = 'executing...';
  } else if (connectionStatus === 'connected') {
    dotClass = styles.connected;
    statusLabel = `${kernelMode} kernel`;
  } else if (connectionStatus === 'connecting') {
    dotClass = styles.connecting;
    statusLabel = 'connecting...';
  } else {
    dotClass = styles.disconnected;
    statusLabel = 'disconnected';
  }

  const pythonLabel = activeVenv
    ? `Python ${activeVenv.pythonVersion.replace('Python ', '')}`
    : 'Python --';

  // ── Mode toggle handler ─────────────────────────────────────────────────

  const handleModeToggle = useCallback(async () => {
    const fromMode = kernelMode;
    const toMode: 'local' | 'remote' = fromMode === 'local' ? 'remote' : 'local';

    // Analyse the current namespace
    let vars: Awaited<ReturnType<typeof analyzeNamespace>> = [];
    try {
      // kernel.inspectAll returns void and updates the store; we need the raw
      // response, so we call the underlying client directly via a thin wrapper.
      // We wrap kernel.inspectAll to capture what the store would receive.
      vars = await analyzeNamespace(
        // Provide a compatible async function that returns the variables
        async () => {
          // Access the current kernel client ref for the active mode
          const client = kernel.client?.current;
          if (!client) return undefined;
          try {
            // Both KernelClient and RemoteKernelClient expose inspectAll()
            return await (client as any).inspectAll();
          } catch {
            return undefined;
          }
        },
      );
    } catch (err) {
      console.warn('[StatusBar] analyzeNamespace failed:', err);
      // Fall through — switch mode without migration
    }

    const report = classifyVariables(vars);
    const totalVars = vars.length;

    if (totalVars === 0) {
      // Empty namespace — switch immediately
      setKernelMode(toMode);
      return;
    }

    // Show migration dialog
    setMigrationError(null);
    setDialogState({ fromMode, toMode, report });
  }, [kernelMode, kernel, setKernelMode]);

  // ── Dialog: Proceed ─────────────────────────────────────────────────────

  const handleProceed = useCallback(async () => {
    if (!dialogState) return;

    const { toMode, report } = dialogState;

    setIsMigrating(true);
    setMigrationError(null);

    try {
      // Switch the mode FIRST so the destination kernel is active for code execution
      setKernelMode(toMode);

      // Give React one tick to propagate the new kernelMode so the
      // `kernel` hook we call next picks up the destination kernel.
      await new Promise<void>((r) => setTimeout(r, 50));

      // Execute migration against the destination kernel (now active)
      // We reuse the executeCode from the kernel ref which has already switched.
      // Since useKernel() is a hook and cannot be called conditionally, we
      // access the destination client directly via a late-binding call.
      const destClient = kernel.client?.current as any;
      if (destClient && report.transferred.length + report.stubbed.length > 0) {
        const failed = await executeMigration(
          report,
          (code) => destClient.execute(code),
        );
        if (failed.length > 0) {
          setMigrationError(
            `${failed.length} variable${failed.length > 1 ? 's' : ''} failed to transfer: ${failed.join(', ')}.`,
          );
          // Keep dialog open to show the error, but mode has already switched
          setIsMigrating(false);
          return;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[StatusBar] Migration failed:', err);
      setMigrationError(msg);
      setIsMigrating(false);
      return;
    }

    setIsMigrating(false);
    setDialogState(null);
  }, [dialogState, setKernelMode, kernel]);

  // ── Dialog: Cancel ──────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    if (!isMigrating) {
      setDialogState(null);
      setMigrationError(null);
    }
  }, [isMigrating]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className={styles.statusBar}>
        {/* Left sections */}
        <div className={styles.section}>
          <div className={`${styles.dot} ${dotClass}`} />
          <span>{statusLabel}</span>
        </div>

        <div className={styles.section}>
          <span>{pythonLabel}</span>
        </div>

        <div
          className={styles.section}
          style={{ cursor: 'pointer' }}
          onClick={handleModeToggle}
          title="Click to toggle kernel mode (LOCAL ↔ REMOTE)"
        >
          <span>Mode: {kernelMode}</span>
        </div>

        {/* Environment selector */}
        {kernelMode === 'remote' ? (
          <RemoteEnvSelector serverUrl={serverUrl} />
        ) : (
          <EnvSelector projectPath={workspacePath || undefined} />
        )}

        {/* uv not installed warning icon */}
        {!uvInstalled && (
          <div className={styles.section} title="uv is not installed — environment management is disabled">
            <span className={styles.uvWarningIcon}>⚠ uv</span>
          </div>
        )}

        <div className={styles.spacer} />

        {/* Right sections */}
        <div className={styles.section}>
          <span>Ln 1, Col 1</span>
        </div>

        <div className={styles.section}>
          <span>${sessionCost.toFixed(4)}</span>
        </div>
      </div>

      {/* Migration dialog — rendered outside the status bar to escape overflow:hidden */}
      {dialogState && (
        <MigrationDialog
          fromMode={dialogState.fromMode}
          toMode={dialogState.toMode}
          report={dialogState.report}
          isMigrating={isMigrating}
          migrationError={migrationError}
          onProceed={handleProceed}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
