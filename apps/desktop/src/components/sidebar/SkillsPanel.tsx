/**
 * Skills Panel Component
 * Displays available skills and allows activation/deactivation
 */

import React, { useEffect, useState } from 'react';
import { useSkillStore } from '../../services/SkillService';
import { ClawHubDialog } from './ClawHubDialog';
import './SkillsPanel.css';

export const SkillsPanel: React.FC = () => {
  const { 
    skills, 
    activeSkills, 
    loadSkills, 
    toggleSkill,
    isSkillActive,
    uninstallClawHubSkill
  } = useSkillStore();
  const [showClawHub, setShowClawHub] = useState(false);
  
  useEffect(() => {
    loadSkills();
  }, [loadSkills]);
  
  if (skills.length === 0) {
    return (
      <div className="skills-panel">
        <div className="skills-panel-header">
          <h3>Skills</h3>
          <button
            className="clawhub-open-btn"
            onClick={() => setShowClawHub(true)}
            title="Browse ClawHub Marketplace"
          >
            🐾 ClawHub
          </button>
        </div>
        <div className="loading">Loading skills...</div>
        {showClawHub && <ClawHubDialog onClose={() => setShowClawHub(false)} />}
      </div>
    );
  }
  
  const bundledSkills = skills.filter(s => s.source === 'bundled');
  const userSkills = skills.filter(s => s.source === 'disk');
  const clawHubSkills = skills.filter(s => s.source === 'clawhub');
  
  return (
    <div className="skills-panel">
      <div className="skills-panel-header">
        <h3>Skills</h3>
        <button
          className="clawhub-open-btn"
          onClick={() => setShowClawHub(true)}
          title="Browse ClawHub Marketplace"
        >
          🐾 ClawHub
        </button>
      </div>
      
      {bundledSkills.length > 0 && (
        <div className="skill-section">
          <h4>Bundled Skills</h4>
          <div className="skill-list">
            {bundledSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isActive={isSkillActive(skill.id)}
                onToggle={() => toggleSkill(skill.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      {userSkills.length > 0 && (
        <div className="skill-section">
          <h4>User Skills</h4>
          <div className="skill-list">
            {userSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isActive={isSkillActive(skill.id)}
                onToggle={() => toggleSkill(skill.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      {clawHubSkills.length > 0 && (
        <div className="skill-section">
          <h4>ClawHub Skills</h4>
          <div className="skill-list">
            {clawHubSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isActive={isSkillActive(skill.id)}
                onToggle={() => toggleSkill(skill.id)}
                onUninstall={() => uninstallClawHubSkill(skill.name)}
              />
            ))}
          </div>
        </div>
      )}
      
      {userSkills.length === 0 && clawHubSkills.length === 0 && (
        <div className="hint">
          <p>Create custom skills in:</p>
          <code>~/.pyide/skills/user/</code>
        </div>
      )}

      {showClawHub && <ClawHubDialog onClose={() => setShowClawHub(false)} />}
    </div>
  );
};

interface SkillCardProps {
  skill: any;
  isActive: boolean;
  onToggle: () => void;
  onUninstall?: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, isActive, onToggle, onUninstall }) => {
  return (
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
            {skill.allowedTools.map((tool: string) => (
              <span key={tool} className="tool-tag">{tool}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
