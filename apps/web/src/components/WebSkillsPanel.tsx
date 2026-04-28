/**
 * WebSkillsPanel
 *
 * Web adapter for the Skills sidebar panel.
 * Receives skill data and actions via props from useWebSkills hook,
 * avoiding direct dependency on the desktop's platform singletons.
 */

import React, { useState, useRef } from 'react';
import type { LoadedSkill } from '../hooks/useWebSkills';

interface WebSkillsPanelProps {
  skills: LoadedSkill[];
  activeSkillIds: Set<string>;
  loading: boolean;
  error: string | null;
  onToggle: (id: string) => void;
  onInstall: (name: string) => void;
  onUninstall: (id: string) => void;
  onInstallFromUrl?: (url: string) => Promise<{ success: boolean; error?: string; skillName?: string }>;
  onInstallFromZip?: (file: File) => Promise<{ success: boolean; error?: string; skillName?: string }>;
}

export const WebSkillsPanel: React.FC<WebSkillsPanelProps> = ({
  skills,
  activeSkillIds,
  loading,
  error,
  onToggle,
  onInstall,
  onUninstall,
  onInstallFromUrl,
  onInstallFromZip,
}) => {
  const [installName, setInstallName] = useState('');
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (t: { type: 'success' | 'error'; message: string }) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(t);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  const bundledSkills = skills.filter((s) => s.source === 'bundled');
  const userSkills = skills.filter((s) => s.source === 'disk');
  const clawHubSkills = skills.filter((s) => s.source === 'clawhub');

  function handleInstall(e: React.FormEvent) {
    e.preventDefault();
    if (installName.trim()) {
      onInstall(installName.trim());
      setInstallName('');
      setShowInstallForm(false);
    }
  }

  if (loading) {
    return (
      <div className="skills-panel">
        <div className="skills-panel-header">
          <h3>Skills</h3>
        </div>
        <div className="loading">Loading skills…</div>
      </div>
    );
  }

  return (
    <div className="skills-panel">
      <div className="skills-panel-header">
        <h3>Skills</h3>
        <div className="header-actions">
          {(onInstallFromUrl || onInstallFromZip) && (
            <button
              className="install-skill-btn"
              onClick={() => setShowInstallDialog(true)}
              title="Install skill from URL or ZIP"
            >
              ↓ Install
            </button>
          )}
          <button
            className="clawhub-open-btn"
            onClick={() => setShowInstallForm((v) => !v)}
            title="Install from ClawHub"
          >
            🐾 ClawHub
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`install-toast ${toast.type}`} style={{ position: 'relative', marginBottom: 4 }}>
          {toast.message}
        </div>
      )}

      {error && (
        <div className="error-message" style={{ marginBottom: 8 }}>
          {error}
        </div>
      )}

      {showInstallForm && (
        <form
          onSubmit={handleInstall}
          style={{ display: 'flex', gap: 6, padding: '8px 0' }}
        >
          <input
            style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)' }}
            placeholder="Skill name (e.g. eda)"
            value={installName}
            onChange={(e) => setInstallName(e.target.value)}
          />
          <button type="submit" className="toggle-btn active">
            Install
          </button>
        </form>
      )}

      {bundledSkills.length > 0 && (
        <div className="skill-section">
          <h4>Bundled Skills</h4>
          <div className="skill-list">
            {bundledSkills.map((skill) => (
              <WebSkillCard
                key={skill.id}
                skill={skill}
                isActive={activeSkillIds.has(skill.id)}
                onToggle={() => onToggle(skill.id)}
              />
            ))}
          </div>
        </div>
      )}

      {userSkills.length > 0 && (
        <div className="skill-section">
          <h4>User Skills</h4>
          <div className="skill-list">
            {userSkills.map((skill) => (
              <WebSkillCard
                key={skill.id}
                skill={skill}
                isActive={activeSkillIds.has(skill.id)}
                onToggle={() => onToggle(skill.id)}
              />
            ))}
          </div>
        </div>
      )}

      {clawHubSkills.length > 0 && (
        <div className="skill-section">
          <h4>ClawHub Skills</h4>
          <div className="skill-list">
            {clawHubSkills.map((skill) => (
              <WebSkillCard
                key={skill.id}
                skill={skill}
                isActive={activeSkillIds.has(skill.id)}
                onToggle={() => onToggle(skill.id)}
                onUninstall={() => onUninstall(skill.id)}
              />
            ))}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <div className="hint">
          <p>No skills loaded from server.</p>
        </div>
      )}

      {userSkills.length === 0 && clawHubSkills.length === 0 && skills.length > 0 && (
        <div className="hint">
          <p>Install custom skills via ClawHub.</p>
        </div>
      )}

      {/* Install Skill Dialog */}
      {showInstallDialog && (
        <WebInstallSkillDialog
          onClose={() => setShowInstallDialog(false)}
          onInstallUrl={async (url) => {
            if (!onInstallFromUrl) return;
            const result = await onInstallFromUrl(url);
            if (result.success) {
              showToast({ type: 'success', message: `Skill "${result.skillName ?? 'skill'}" installed` });
              setShowInstallDialog(false);
            } else {
              showToast({ type: 'error', message: result.error || 'Installation failed' });
            }
          }}
          onInstallZip={async (file) => {
            if (!onInstallFromZip) return;
            const result = await onInstallFromZip(file);
            if (result.success) {
              showToast({ type: 'success', message: `Skill "${result.skillName ?? 'skill'}" installed` });
              setShowInstallDialog(false);
            } else {
              showToast({ type: 'error', message: result.error || 'Failed to install skill' });
            }
          }}
          hasUrl={!!onInstallFromUrl}
          hasZip={!!onInstallFromZip}
        />
      )}
    </div>
  );
};

// ── WebInstallSkillDialog ──────────────────────────────────────

interface WebInstallSkillDialogProps {
  onClose: () => void;
  onInstallUrl: (url: string) => Promise<void>;
  onInstallZip: (file: File) => Promise<void>;
  hasUrl: boolean;
  hasZip: boolean;
}

const WebInstallSkillDialog: React.FC<WebInstallSkillDialogProps> = ({
  onClose,
  onInstallUrl,
  onInstallZip,
  hasUrl,
  hasZip,
}) => {
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isInstallingUrl, setIsInstallingUrl] = useState(false);
  const [isInstallingZip, setIsInstallingZip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInstallUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlValue.trim();
    if (!trimmed) { setUrlError('Please enter a URL'); return; }
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setUrlError('Only http:// and https:// URLs are supported');
        return;
      }
      const path = parsed.pathname.toLowerCase();
      if (!path.endsWith('.md') && !path.endsWith('.zip')) {
        setUrlError('URL must end with .md or .zip');
        return;
      }
    } catch {
      setUrlError('Invalid URL format');
      return;
    }
    setUrlError(null);
    setIsInstallingUrl(true);
    try { await onInstallUrl(trimmed); }
    finally { setIsInstallingUrl(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith('.zip')) return;
    setIsInstallingZip(true);
    try { await onInstallZip(file); }
    finally {
      setIsInstallingZip(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="install-dialog">
        <div className="skill-detail-header">
          <h3>Install Skill</h3>
          <button className="detail-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="install-dialog-body">
          {hasUrl && (
            <div className="install-section">
              <h4>Install from URL</h4>
              <p className="install-hint">Paste a link to a <code>.md</code> skill file or <code>.zip</code> package.</p>
              <form onSubmit={handleInstallUrl} className="install-url-form">
                <input
                  className="install-url-input"
                  type="text"
                  placeholder="https://example.com/skill.md"
                  value={urlValue}
                  onChange={e => { setUrlValue(e.target.value); setUrlError(null); }}
                  disabled={isInstallingUrl}
                  autoFocus
                />
                {urlError && <p className="install-url-error">{urlError}</p>}
                <button
                  type="submit"
                  className="install-submit-btn"
                  disabled={isInstallingUrl || !urlValue.trim()}
                >
                  {isInstallingUrl
                    ? <><span className="install-spinner" />Installing…</>
                    : 'Install from URL'}
                </button>
              </form>
            </div>
          )}

          {hasUrl && hasZip && <div className="install-divider"><span>or</span></div>}

          {hasZip && (
            <div className="install-section">
              <h4>Install from ZIP file</h4>
              <p className="install-hint">Upload a <code>.zip</code> skill package from your device.</p>
              <button
                className="install-zip-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isInstallingZip}
              >
                {isInstallingZip
                  ? <><span className="install-spinner" />Installing…</>
                  : '📂 Choose ZIP file…'}
              </button>
              <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── WebSkillCard ─────────────────────────────────────────────────────────────

interface WebSkillCardProps {
  skill: LoadedSkill;
  isActive: boolean;
  onToggle: () => void;
  onUninstall?: () => void;
}

const WebSkillCard: React.FC<WebSkillCardProps> = ({
  skill,
  isActive,
  onToggle,
  onUninstall,
}) => (
  <div className={`skill-card ${isActive ? 'active' : ''}`}>
    <div className="skill-header">
      <div className="skill-info">
        <span className="skill-name">{skill.name}</span>
        <span className={`skill-source ${skill.source}`}>{skill.source}</span>
      </div>
      <div className="skill-actions">
        {onUninstall && (
          <button
            className="uninstall-btn"
            onClick={onUninstall}
            title="Uninstall skill"
          >
            ✕
          </button>
        )}
        <button
          className={`toggle-btn ${isActive ? 'active' : ''}`}
          onClick={onToggle}
          title={isActive ? 'Deactivate skill' : 'Activate skill'}
        >
          {isActive ? '✓' : '○'}
        </button>
      </div>
    </div>

    <p className="skill-description">{skill.description}</p>

    {skill.whenToUse && (
      <p className="skill-when-to-use">
        <strong>When:</strong> {skill.whenToUse}
      </p>
    )}

    {skill.argumentHint && (
      <p className="skill-hint">
        <strong>Usage:</strong> /{skill.name} {skill.argumentHint}
      </p>
    )}

    {skill.allowedTools && skill.allowedTools.length > 0 && (
      <div className="skill-tools">
        <strong>Tools:</strong>
        <div className="tool-tags">
          {skill.allowedTools.map((tool) => (
            <span key={tool} className="tool-tag">
              {tool}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);
