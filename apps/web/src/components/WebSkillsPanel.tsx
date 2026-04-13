/**
 * WebSkillsPanel
 *
 * Web adapter for the Skills sidebar panel.
 * Receives skill data and actions via props from useWebSkills hook,
 * avoiding direct dependency on the desktop's platform singletons.
 */

import React, { useState } from 'react';
import type { LoadedSkill } from '../hooks/useWebSkills';

interface WebSkillsPanelProps {
  skills: LoadedSkill[];
  activeSkillIds: Set<string>;
  loading: boolean;
  error: string | null;
  onToggle: (id: string) => void;
  onInstall: (name: string) => void;
  onUninstall: (id: string) => void;
}

export const WebSkillsPanel: React.FC<WebSkillsPanelProps> = ({
  skills,
  activeSkillIds,
  loading,
  error,
  onToggle,
  onInstall,
  onUninstall,
}) => {
  const [installName, setInstallName] = useState('');
  const [showInstallForm, setShowInstallForm] = useState(false);

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
        <button
          className="clawhub-open-btn"
          onClick={() => setShowInstallForm((v) => !v)}
          title="Install from ClawHub"
        >
          🐾 ClawHub
        </button>
      </div>

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
