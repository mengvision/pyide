import { useState, useRef, useEffect, useCallback } from 'react';
import { useKernel } from '../../hooks/useKernel';
import styles from './RemoteEnvSelector.module.css';

interface RemoteEnvSelectorProps {
  serverUrl: string;
}

/**
 * RemoteEnvSelector - Dropdown for selecting Python environment templates in remote mode.
 * 
 * Displays available environment templates configured by the server admin.
 * Users can select a template before starting the remote kernel.
 */
export function RemoteEnvSelector({ serverUrl }: RemoteEnvSelectorProps) {
  const {
    selectedTemplateId,
    setSelectedTemplateId,
    availableTemplates,
    connectionStatus,
  } = useKernel() as any; // Type will be updated when useKernel types are enhanced

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selectTemplate = useCallback(
    (templateId: number | null) => {
      setSelectedTemplateId(templateId);
      setOpen(false);
    },
    [setSelectedTemplateId],
  );

  const selectedTemplate = availableTemplates.find((t: any) => t.id === selectedTemplateId);

  const label = selectedTemplate
    ? `${selectedTemplate.display_name} (${selectedTemplate.python_version})`
    : 'System Python';

  const isConnected = connectionStatus === 'connected';

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={`${styles.trigger} ${open ? styles.triggerActive : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={isConnected}
        title={isConnected ? 'Disconnect first to change environment' : 'Select Python environment template'}
      >
        <span className={styles.envIcon}>⬡</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.caret}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>Environment Templates</div>

          {/* Default option: System Python */}
          <button
            className={`${styles.templateItem} ${selectedTemplateId === null ? styles.templateItemActive : ''}`}
            onClick={() => selectTemplate(null)}
          >
            <span className={styles.templateName}>System Python</span>
            <span className={styles.templateDesc}>Use server's default Python</span>
            {selectedTemplateId === null && (
              <span className={styles.activeIndicator}>✓</span>
            )}
          </button>

          {availableTemplates.length === 0 && (
            <div className={styles.emptyMsg}>
              No templates available
              <br />
              <span className={styles.hint}>Contact your server admin</span>
            </div>
          )}

          {/* Environment templates from server */}
          {availableTemplates.map((template: any) => (
            <button
              key={template.id}
              className={`${styles.templateItem} ${selectedTemplateId === template.id ? styles.templateItemActive : ''}`}
              onClick={() => selectTemplate(template.id)}
            >
              <div className={styles.templateInfo}>
                <span className={styles.templateName}>{template.display_name}</span>
                <span className={styles.templatePython}>Python {template.python_version}</span>
                {template.description && (
                  <span className={styles.templateDesc}>{template.description}</span>
                )}
                {template.packages && template.packages.length > 0 && (
                  <span className={styles.packageCount}>
                    {template.packages.length} package{template.packages.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {selectedTemplateId === template.id && (
                <span className={styles.activeIndicator}>✓</span>
              )}
            </button>
          ))}

          <div className={styles.divider} />
          <div className={styles.footer}>
            Templates are managed by server admin
          </div>
        </div>
      )}
    </div>
  );
}
