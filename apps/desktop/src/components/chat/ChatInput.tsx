import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle, KeyboardEvent, ChangeEvent } from 'react';
import styles from './ChatInput.module.css';
import { useSkillStore } from '../../services/SkillService';
import type { LoadedSkill } from '../../types/skill';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export interface ChatInputHandle {
  focus: () => void;
}

interface SlashState {
  active: boolean;
  query: string;
  selectedIndex: number;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ onSend, onStop, isStreaming, disabled = false }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [slash, setSlash] = useState<SlashState>({ active: false, query: '', selectedIndex: 0 });

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    // Get skills list for autocomplete
    const skills = useSkillStore((state) => state.skills);

    // Filtered candidates based on slash query
    const candidates = useSlashCandidates(skills, slash.active ? slash.query : '');

    // Auto-resize textarea on content change
    const resize = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, []);

    useEffect(() => {
      resize();
    }, [resize]);

    // Detect slash command at cursor position
    const detectSlash = useCallback((): SlashState => {
      const el = textareaRef.current;
      if (!el) return { active: false, query: '', selectedIndex: 0 };

      const value = el.value;
      const pos = el.selectionStart;
      if (pos === 0 || value[pos - 1] !== '/') return { active: false, query: '', selectedIndex: 0 };

      // Walk back to find the start of the current "word" that begins with /
      let start = pos - 1;
      while (start > 0 && value[start - 1] !== ' ' && value[start - 1] !== '\n') {
        start--;
      }

      // Ensure the word starts with /
      if (value[start] !== '/') return { active: false, query: '', selectedIndex: 0 };

      const query = value.substring(start + 1, pos);
      return { active: true, query, selectedIndex: 0 };
    }, []);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      resize();
      const newSlash = detectSlash();
      setSlash(prev => ({
        active: newSlash.active,
        query: newSlash.query,
        selectedIndex: Math.min(prev.selectedIndex, Math.max(0, useSlashCandidates(skills, newSlash.query).length - 1)),
      }));
    };

    // Insert the selected skill name into the textarea
    const insertSkillName = useCallback((skill: LoadedSkill) => {
      const el = textareaRef.current;
      if (!el) return;

      const value = el.value;
      const pos = el.selectionStart;

      // Find the start of the /word
      let start = pos - 1;
      while (start > 0 && value[start - 1] !== ' ' && value[start - 1] !== '\n') {
        start--;
      }

      const before = value.substring(0, start);
      const after = value.substring(pos);
      const argHint = skill.argumentHint ? ` ${skill.argumentHint}` : '';
      const insert = `/${skill.name}${argHint} `;

      el.value = before + insert + after;
      el.selectionStart = el.selectionEnd = before.length + insert.length;
      el.focus();
      resize();

      // Close slash menu
      setSlash({ active: false, query: '', selectedIndex: 0 });
    }, [resize]);

    const submit = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      const value = el.value.trim();
      if (!value || isStreaming) return;
      el.value = '';
      el.style.height = 'auto';
      setSlash({ active: false, query: '', selectedIndex: 0 });
      onSend(value);
    }, [isStreaming, onSend]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle autocomplete navigation
        if (slash.active && candidates.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSlash(prev => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % candidates.length,
            }));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSlash(prev => ({
              ...prev,
              selectedIndex: (prev.selectedIndex - 1 + candidates.length) % candidates.length,
            }));
            return;
          }
          if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
            e.preventDefault();
            const selected = candidates[slash.selectedIndex];
            if (selected) {
              insertSkillName(selected);
            }
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setSlash({ active: false, query: '', selectedIndex: 0 });
            return;
          }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      },
      [slash, candidates, insertSkillName, submit],
    );

    // Close slash menu when clicking outside
    useEffect(() => {
      if (!slash.active) return;
      const handler = () => setSlash(prev => prev.active ? { active: false, query: '', selectedIndex: 0 } : prev);
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }, [slash.active]);

    return (
      <div className={styles.inputArea} style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Ask anything... (/ to invoke a skill)"
          rows={1}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled && !isStreaming}
        />
        {/* Skill autocomplete popup */}
        {slash.active && candidates.length > 0 && (
          <SkillAutocomplete
            candidates={candidates}
            selectedIndex={slash.selectedIndex}
            onSelect={(skill) => {
              insertSkillName(skill);
            }}
          />
        )}
        <div className={styles.actions}>
          {isStreaming ? (
            <button className={`${styles.btn} ${styles.stopBtn}`} onClick={onStop} title="Stop">
              ■ Stop
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.sendBtn}`}
              onClick={submit}
              disabled={disabled}
              title="Send (Enter)"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    );
  },
);

ChatInput.displayName = 'ChatInput';

// ── Hook: filter skills by slash query ──────────────────────────

function useSlashCandidates(skills: LoadedSkill[], query: string): LoadedSkill[] {
  return skills.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q);
  }).slice(0, 8);
}

// ── Autocomplete Popup Component ────────────────────────────────

interface AutocompleteProps {
  candidates: LoadedSkill[];
  selectedIndex: number;
  onSelect: (skill: LoadedSkill) => void;
}

function SkillAutocomplete({ candidates, selectedIndex, onSelect }: AutocompleteProps) {
  return (
    <div className={styles.autocomplete}>
      {candidates.map((skill, idx) => (
        <div
          key={skill.id}
          className={`${styles.autocompleteItem} ${idx === selectedIndex ? styles.selected : ''}`}
          onClick={() => onSelect(skill)}
          onMouseEnter={() => {
            // Update parent selectedIndex on hover — handled via direct DOM approach
          }}
        >
          <span className={styles.skillName}>/{skill.name}</span>
          <span className={styles.skillDesc}>
            {skill.description.length > 50
              ? skill.description.slice(0, 47) + '...'
              : skill.description}
          </span>
          <span className={`${styles.skillSource} ${skill.source}`}>{skill.source}</span>
        </div>
      ))}
    </div>
  );
}
