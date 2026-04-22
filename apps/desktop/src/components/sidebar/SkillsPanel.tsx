/**
 * Skills Panel Component
 * Displays available skills with search, filtering, and detail view.
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSkillStore } from '../../services/SkillService';
import { ClawHubDialog } from './ClawHubDialog';
import { getSkillUsageScore } from '../../services/SkillService/usageTracking';
import type { LoadedSkill } from '../../types/skill';
import './SkillsPanel.css';

type InstallToast = { type: 'success' | 'error'; message: string };

export const SkillsPanel: React.FC = () => {
  const {
    skills,
    loadSkills,
    toggleSkill,
    isSkillActive,
    uninstallClawHubSkill,
    installFromZip,
  } = useSkillStore();
  const [showClawHub, setShowClawHub] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailSkill, setDetailSkill] = useState<LoadedSkill | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [toast, setToast] = useState<InstallToast | null>(null);
  const dragCounterRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Show toast notification
  const showToast = useCallback((t: InstallToast) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(t);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Drag & Drop handlers ──────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const zipFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip'));

    if (zipFiles.length === 0) {
      showToast({ type: 'error', message: 'Please drop a .zip file containing a skill' });
      return;
    }

    setIsInstalling(true);
    for (const file of zipFiles) {
      const result = await installFromZip(file);
      if (result.success) {
        showToast({ type: 'success', message: `Skill "${result.skillName}" installed` });
      } else {
        showToast({ type: 'error', message: result.error || 'Failed to install skill' });
      }
    }
    setIsInstalling(false);
  }, [installFromZip, showToast]);

  // Filter skills by search query
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const q = searchQuery.toLowerCase();
    return skills.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.whenToUse?.toLowerCase().includes(q),
    );
  }, [skills, searchQuery]);

  // Group by source
  const grouped = useMemo(() => {
    const groups: Record<string, LoadedSkill[]> = {
      bundled: [],
      project: [],
      disk: [],
      clawhub: [],
    };
    for (const skill of filteredSkills) {
      if (groups[skill.source]) {
        groups[skill.source].push(skill);
      }
    }
    return groups;
  }, [filteredSkills]);

  const sourceLabels: Record<string, string> = {
    bundled: 'Bundled',
    project: 'Project',
    disk: 'User',
    clawhub: 'ClawHub',
  };

  const sourceOrder = ['bundled', 'project', 'disk', 'clawhub'];

  return (
    <div
      className="skills-panel"
      ref={panelRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="drop-zone-overlay">
          <div className="drop-zone-content">
            <span className="drop-zone-icon">📦</span>
            <span className="drop-zone-text">Drop skill .zip file to install</span>
          </div>
        </div>
      )}

      {/* Install toast */}
      {toast && (
        <div className={`install-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
      {/* Header */}
      <div className="skills-panel-header">
        <h3>Skills</h3>
        <div className="header-actions">
          <button
            className="create-skill-btn"
            onClick={() => setDetailSkill(NEW_SKILL_SENTINEL as any)}
            title="Create new skill"
          >
            +
          </button>
          <button
            className="clawhub-open-btn"
            onClick={() => setShowClawHub(true)}
            title="Browse ClawHub Marketplace"
          >
            🐾
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="skills-search">
        <input
          type="text"
          className="skills-search-input"
          placeholder="Search skills..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Skill Sections */}
      {skills.length === 0 ? (
        <div className="loading">Loading skills...</div>
      ) : filteredSkills.length === 0 ? (
        <div className="no-results">No skills match "{searchQuery}"</div>
      ) : (
        sourceOrder.map(source => {
          const group = grouped[source];
          if (!group || group.length === 0) return null;
          return (
            <div className="skill-section" key={source}>
              <h4>{sourceLabels[source]}</h4>
              <div className="skill-list">
                {group.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isActive={isSkillActive(skill.id)}
                    onToggle={() => toggleSkill(skill.id)}
                    onDetail={() => setDetailSkill(skill)}
                    onUninstall={
                      source === 'clawhub'
                        ? () => uninstallClawHubSkill(skill.name)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Hint for creating skills */}
      {grouped.disk.length === 0 && grouped.clawhub.length === 0 && grouped.project.length === 0 && (
        <div className="hint">
          <p>Create custom skills in:</p>
          <code>~/.pyide/skills/user/</code>
        </div>
      )}

      {/* ClawHub Dialog */}
      {showClawHub && <ClawHubDialog onClose={() => setShowClawHub(false)} />}

      {/* Skill Detail Modal */}
      {detailSkill && (
        <SkillDetailModal
          skill={detailSkill}
          isNew={detailSkill === NEW_SKILL_SENTINEL}
          isActive={
            detailSkill === NEW_SKILL_SENTINEL
              ? false
              : isSkillActive(detailSkill.id)
          }
          onToggle={
            detailSkill === NEW_SKILL_SENTINEL
              ? undefined
              : () => toggleSkill(detailSkill.id)
          }
          onClose={() => setDetailSkill(null)}
        />
      )}
    </div>
  );
};

// ── Sentinel for "create new skill" ────────────────────────────────
const NEW_SKILL_SENTINEL = {} as LoadedSkill;

// ── Skill Card ─────────────────────────────────────────────────────

interface SkillCardProps {
  skill: LoadedSkill;
  isActive: boolean;
  onToggle: () => void;
  onDetail: () => void;
  onUninstall?: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  isActive,
  onToggle,
  onDetail,
  onUninstall,
}) => {
  const usageScore = getSkillUsageScore(skill.name);

  return (
    <div className={`skill-card ${isActive ? 'active' : ''}`}>
      <div className="skill-header">
        <div className="skill-info" onClick={onDetail} title="View details">
          <span className="skill-name">{skill.name}</span>
          <span className={`skill-source ${skill.source}`}>{skill.source}</span>
          {skill.paths && skill.paths.length > 0 && (
            <span className="skill-auto-badge" title="Auto-activates on matching files">
              auto
            </span>
          )}
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

      <p className="skill-description" onClick={onDetail}>
        {skill.description}
      </p>

      {/* Argument hint */}
      {skill.argumentHint && (
        <p className="skill-hint">
          /{skill.name} <span className="hint-args">{skill.argumentHint}</span>
        </p>
      )}

      {/* Usage frequency indicator */}
      {usageScore > 0 && (
        <div className="skill-usage-bar">
          <div
            className="skill-usage-fill"
            style={{ width: `${Math.min(usageScore * 10, 100)}%` }}
          />
        </div>
      )}

      {/* Path patterns */}
      {skill.paths && skill.paths.length > 0 && (
        <div className="skill-paths">
          {skill.paths.map(p => (
            <span key={p} className="path-tag">{p}</span>
          ))}
        </div>
      )}

      {/* Tool tags */}
      {skill.allowedTools && skill.allowedTools.length > 0 && (
        <div className="skill-tools">
          {skill.allowedTools.map(tool => (
            <span key={tool} className="tool-tag">{tool}</span>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Skill Detail Modal ─────────────────────────────────────────────

interface SkillDetailModalProps {
  skill: LoadedSkill;
  isNew: boolean;
  isActive: boolean;
  onToggle?: () => void;
  onClose: () => void;
}

const SkillDetailModal: React.FC<SkillDetailModalProps> = ({
  skill,
  isNew,
  isActive,
  onToggle,
  onClose,
}) => {
  const usageScore = getSkillUsageScore(skill.name);

  return (
    <div className="skill-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="skill-detail-modal">
        <div className="skill-detail-header">
          <h3>{isNew ? 'Create New Skill' : skill.name}</h3>
          <button className="detail-close-btn" onClick={onClose}>✕</button>
        </div>

        {isNew ? (
          <div className="skill-detail-body">
            <p className="detail-create-hint">
              Create a skill by adding a <code>SKILL.md</code> file to:
            </p>
            <code className="detail-create-path">~/.pyide/skills/user/&lt;name&gt;/SKILL.md</code>
            <p className="detail-create-hint" style={{ marginTop: 12 }}>
              Or a flat markdown file:
            </p>
            <code className="detail-create-path">~/.pyide/skills/user/&lt;name&gt;.md</code>
            <pre className="detail-template">{`---
name: my-skill
description: Description of what this skill does
allowed_tools:
  - execute_python_code
arguments:
  - name: input
    type: string
    required: true
paths:
  - "**/*.py"
---

# My Skill Instructions

Write your skill instructions here...
Use $ARGUMENTS or $input for parameter substitution.`}</pre>
          </div>
        ) : (
          <div className="skill-detail-body">
            {/* Metadata */}
            <div className="detail-meta">
              <span className={`skill-source ${skill.source}`}>{skill.source}</span>
              {skill.context && <span className="detail-badge">context: {skill.context}</span>}
              {usageScore > 0 && (
                <span className="detail-badge">usage score: {usageScore.toFixed(1)}</span>
              )}
            </div>

            {/* Description */}
            <p className="detail-description">{skill.description}</p>

            {/* When to use */}
            {skill.whenToUse && (
              <div className="detail-section">
                <h4>When to use</h4>
                <p>{skill.whenToUse}</p>
              </div>
            )}

            {/* Arguments */}
            {skill.args && skill.args.length > 0 && (
              <div className="detail-section">
                <h4>Arguments</h4>
                <table className="detail-args-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skill.args.map(arg => (
                      <tr key={arg.name}>
                        <td className="arg-name">${arg.name}</td>
                        <td>{arg.type}</td>
                        <td>{arg.required ? 'Yes' : 'No'}</td>
                        <td>{arg.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Path patterns */}
            {skill.paths && skill.paths.length > 0 && (
              <div className="detail-section">
                <h4>Auto-activates on</h4>
                <div className="detail-paths">
                  {skill.paths.map(p => (
                    <code key={p} className="detail-path">{p}</code>
                  ))}
                </div>
              </div>
            )}

            {/* Allowed tools */}
            {skill.allowedTools && skill.allowedTools.length > 0 && (
              <div className="detail-section">
                <h4>Allowed tools</h4>
                <div className="detail-tools">
                  {skill.allowedTools.map(t => (
                    <span key={t} className="tool-tag">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Supporting files */}
            {skill.files && skill.files.length > 0 && (
              <div className="detail-section">
                <h4>Supporting files</h4>
                <ul className="detail-files">
                  {skill.files.map(f => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Content preview */}
            <div className="detail-section">
              <h4>Content</h4>
              <pre className="detail-content">{skill.content}</pre>
            </div>
          </div>
        )}

        {/* Footer */}
        {!isNew && onToggle && (
          <div className="skill-detail-footer">
            <button
              className={`detail-toggle-btn ${isActive ? 'deactivate' : 'activate'}`}
              onClick={onToggle}
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
