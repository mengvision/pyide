/**
 * ClawHub Skill Marketplace Dialog
 * Browse and install skills from the ClawHub external registry.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { searchSkills, getPopularSkills, getTrendingSkills, getLocalIndex, type ClawHubSkill } from '../../services/SkillService/clawhub';
import { useSkillStore } from '../../services/SkillService';
import './ClawHubDialog.css';

interface ClawHubDialogProps {
  onClose: () => void;
}

type InstallState = 'idle' | 'installing' | 'success' | 'error';
type BrowseTab = 'popular' | 'trending' | 'search';

export const ClawHubDialog: React.FC<ClawHubDialogProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClawHubSkill[]>([]);
  const [searching, setSearching] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});
  const [activeTab, setActiveTab] = useState<BrowseTab>('popular');
  const inputRef = useRef<HTMLInputElement>(null);
  const { installFromClawHub, skills: installedSkills } = useSkillStore();

  // Focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load popular skills on mount
  useEffect(() => {
    if (activeTab === 'popular') {
      loadPopular();
    } else if (activeTab === 'trending') {
      loadTrending();
    }
  }, [activeTab]);

  const loadPopular = useCallback(async () => {
    setSearching(true);
    setApiUnavailable(false);
    try {
      const skills = await getPopularSkills(20);
      setResults(skills);
      if (skills.length === 0) {
        setApiUnavailable(true);
        setResults(getLocalIndex());
      }
    } catch {
      setApiUnavailable(true);
      setResults(getLocalIndex());
    } finally {
      setSearching(false);
    }
  }, []);

  const loadTrending = useCallback(async () => {
    setSearching(true);
    setApiUnavailable(false);
    try {
      const skills = await getTrendingSkills(20);
      setResults(skills);
      if (skills.length === 0) {
        setApiUnavailable(true);
        setResults(getLocalIndex());
      }
    } catch {
      setApiUnavailable(true);
      setResults(getLocalIndex());
    } finally {
      setSearching(false);
    }
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      setApiUnavailable(false);
      return;
    }
    setActiveTab('search');
    setSearching(true);
    setApiUnavailable(false);
    try {
      const found = await searchSkills(q.trim());
      setResults(found);
      if (found.length === 0) {
        setApiUnavailable(true);
      }
    } catch {
      setResults([]);
      setApiUnavailable(true);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 400);
  };

  const isInstalled = (skillName: string) =>
    installedSkills.some(s => s.source === 'clawhub' && s.name === skillName);

  const handleInstall = async (skill: ClawHubSkill) => {
    setInstallStates(s => ({ ...s, [skill.name]: 'installing' }));
    const ok = await installFromClawHub(skill.name);
    setInstallStates(s => ({ ...s, [skill.name]: ok ? 'success' : 'error' }));
  };

  return (
    <div className="clawhub-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="clawhub-dialog" role="dialog" aria-modal="true" aria-label="ClawHub Marketplace">
        {/* Header */}
        <div className="clawhub-header">
          <div className="clawhub-title">
            <span className="clawhub-logo">🐾</span>
            <h2>ClawHub Marketplace</h2>
          </div>
          <button className="clawhub-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Search */}
        <div className="clawhub-search-bar">
          <span className="search-icon">⌕</span>
          <input
            ref={inputRef}
            type="text"
            className="clawhub-search-input"
            placeholder="Search skills… (e.g. pandas, git, testing)"
            value={query}
            onChange={onQueryChange}
          />
          {searching && <span className="search-spinner" />}
        </div>

        {/* Browse tabs */}
        <div className="clawhub-tabs">
          <button
            className={`clawhub-tab ${activeTab === 'popular' ? 'active' : ''}`}
            onClick={() => { setActiveTab('popular'); setQuery(''); }}
          >
            Popular
          </button>
          <button
            className={`clawhub-tab ${activeTab === 'trending' ? 'active' : ''}`}
            onClick={() => { setActiveTab('trending'); setQuery(''); }}
          >
            Trending
          </button>
          <button
            className={`clawhub-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => inputRef.current?.focus()}
          >
            Search
          </button>
        </div>

        {/* Body */}
        <div className="clawhub-body">
          {/* API unavailable notice */}
          {apiUnavailable && !searching && (
            <div className="clawhub-notice">
              <span className="notice-icon">⚠</span>
              <div>
                <strong>Showing built-in skill catalog.</strong>
                <p>The ClawHub API is not reachable. Below are curated starter skills you can install manually.</p>
              </div>
            </div>
          )}

          {/* Empty search */}
          {activeTab === 'search' && !query.trim() && !searching && (
            <div className="clawhub-empty">
              <span className="empty-icon">🔍</span>
              <p>Search for skills to install from ClawHub.</p>
              <p className="empty-hint">Try "pandas", "git", "testing", or "visualization".</p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <ul className="clawhub-results">
              {results.map(skill => {
                const state = installStates[skill.name] ?? 'idle';
                const installed = isInstalled(skill.name);
                return (
                  <li key={skill.name} className="clawhub-result-item">
                    <div className="result-meta">
                      <div className="result-top">
                        <span className="result-name">{skill.name}</span>
                        <span className="result-version">v{skill.version}</span>
                        {skill.tags.map(tag => (
                          <span key={tag} className="result-tag">{tag}</span>
                        ))}
                      </div>
                      <p className="result-description">{skill.description}</p>
                      <div className="result-footer">
                        <span className="result-author">by {skill.author}</span>
                        <span className="result-downloads">↓ {skill.downloads.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="result-actions">
                      {installed || state === 'success' ? (
                        <span className="install-badge installed">✓ Installed</span>
                      ) : state === 'error' ? (
                        <button
                          className="install-btn retry"
                          onClick={() => handleInstall(skill)}
                        >
                          Retry
                        </button>
                      ) : (
                        <button
                          className={`install-btn ${state === 'installing' ? 'loading' : ''}`}
                          disabled={state === 'installing'}
                          onClick={() => handleInstall(skill)}
                        >
                          {state === 'installing' ? 'Installing…' : 'Install'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="clawhub-footer">
          <span>Skills are saved to <code>~/.pyide/skills/</code></span>
          <a href="https://clawhub.io" target="_blank" rel="noreferrer" className="clawhub-link">
            clawhub.io ↗
          </a>
        </div>
      </div>
    </div>
  );
};
