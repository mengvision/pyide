/**
 * useSkillAutocomplete
 *
 * React hook providing slash-command autocomplete for the chat input.
 *
 * Trigger: typing `/` at the beginning of the message (or after a newline).
 * Selecting a suggestion calls `activateSkill(id)` in the skill store and
 * removes the `/command` token from the input text.
 *
 * Special command: `/clear` deactivates all currently active skills.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSkillStore } from '../services/SkillService';

// ── Public types ────────────────────────────────────────────────────────────

export interface SkillSuggestion {
  id: string;
  name: string;
  description: string;
}

export interface UseSkillAutocompleteReturn {
  /** Current filtered suggestions (max 5). */
  suggestions: SkillSuggestion[];
  /** Whether the popup should be visible. */
  isOpen: boolean;
  /** Zero-based index of the highlighted suggestion. */
  selectedIndex: number;
  /** Call this whenever the textarea value changes. */
  handleInputChange: (text: string) => void;
  /**
   * Call this from the textarea's onKeyDown.
   * Returns `true` if the event was consumed (caller should not process it).
   */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  /** Call when the user clicks a suggestion item. */
  selectSuggestion: (index: number) => void;
  /**
   * The processed input text — identical to the raw text in normal cases,
   * but with the `/command` token stripped after a skill is activated.
   */
  processedText: string;
  /** Name of the skill activated via slash command (null if none). */
  activatedSkillName: string | null;
  /** Reset all autocomplete state (e.g. after the message is sent). */
  reset: () => void;
}

// ── Special pseudo-commands ─────────────────────────────────────────────────

const SPECIAL_CLEAR: SkillSuggestion = {
  id: '__clear__',
  name: 'clear',
  description: 'Deactivate all active skills',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the slash-command token that is immediately before `cursorPos` in
 * `text`, or null if the cursor is not at the end of a slash-command.
 *
 * A slash-command starts after BOL (position 0) or after a newline.
 */
function extractSlashToken(
  text: string,
  cursorPos: number,
): { slashStart: number; query: string } | null {
  if (cursorPos === 0) return null;

  // Walk backwards from cursor until we find '/', ' ', or '\n'
  let i = cursorPos - 1;
  while (i >= 0 && text[i] !== '/' && text[i] !== ' ' && text[i] !== '\n') {
    i--;
  }

  // We need to land on a '/'
  if (i < 0 || text[i] !== '/') return null;

  // The '/' must be at position 0 or preceded by a newline / space
  if (i > 0 && text[i - 1] !== '\n' && text[i - 1] !== ' ') return null;

  const query = text.substring(i + 1, cursorPos);
  return { slashStart: i, query };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSkillAutocomplete(): UseSkillAutocompleteReturn {
  const skills = useSkillStore((s) => s.skills);
  const activateSkill = useSkillStore((s) => s.activateSkill);
  const deactivateSkill = useSkillStore((s) => s.deactivateSkill);
  const activeSkills = useSkillStore((s) => s.activeSkills);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activatedSkillName, setActivatedSkillName] = useState<string | null>(null);
  const [processedText, setProcessedText] = useState('');
  const [slashStart, setSlashStart] = useState<number>(0);

  // ── Derive suggestions from the current query ─────────────────────────────

  const suggestions = useMemo<SkillSuggestion[]>(() => {
    if (!isOpen) return [];

    const q = query.toLowerCase();
    const results: SkillSuggestion[] = [];

    // Add /clear if the query matches
    if ('clear'.startsWith(q)) {
      results.push(SPECIAL_CLEAR);
    }

    for (const skill of skills) {
      if (results.length >= 5) break;
      if (
        skill.name.toLowerCase().startsWith(q) ||
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q)
      ) {
        results.push({ id: skill.id, name: skill.name, description: skill.description });
        if (results.length >= 5) break;
      }
    }

    return results;
  }, [isOpen, query, skills]);

  // ── Handle input text change ───────────────────────────────────────────────

  const handleInputChange = useCallback(
    (text: string) => {
      setProcessedText(text);

      // We parse from the end of the string to detect the active slash token
      const cursor = text.length;
      const token = extractSlashToken(text, cursor);

      if (token) {
        setQuery(token.query);
        setSlashStart(token.slashStart);
        setIsOpen(true);
        setSelectedIndex(0);
      } else {
        setIsOpen(false);
        setQuery('');
      }
    },
    [],
  );

  // ── Activate a suggestion ─────────────────────────────────────────────────

  const activateSuggestion = useCallback(
    (suggestion: SkillSuggestion, currentText: string): string => {
      if (suggestion.id === '__clear__') {
        // Deactivate all active skills
        [...activeSkills].forEach((id) => deactivateSkill(id));
        setActivatedSkillName(null);
      } else {
        activateSkill(suggestion.id);
        setActivatedSkillName(suggestion.name);
      }

      // Remove the /command token from the text
      const before = currentText.substring(0, slashStart);
      const after = currentText.substring(slashStart + 1 + query.length);
      // Trim any leading space left over when the slash was mid-line
      const newText = (before + after).replace(/^\s+/, '');

      setIsOpen(false);
      setQuery('');
      setProcessedText(newText);
      return newText;
    },
    [activeSkills, activateSkill, deactivateSkill, slashStart, query],
  );

  // ── Public API: selectSuggestion ──────────────────────────────────────────

  const selectSuggestion = useCallback(
    (index: number) => {
      const suggestion = suggestions[index];
      if (!suggestion) return;
      activateSuggestion(suggestion, processedText);
    },
    [suggestions, processedText, activateSuggestion],
  );

  // ── Public API: handleKeyDown ─────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || suggestions.length === 0) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          return true;

        case 'Tab':
        case 'Enter': {
          if (e.key === 'Enter' && e.shiftKey) return false;
          e.preventDefault();
          const chosen = suggestions[selectedIndex];
          if (chosen) activateSuggestion(chosen, processedText);
          return true;
        }

        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          return true;

        default:
          return false;
      }
    },
    [isOpen, suggestions, selectedIndex, processedText, activateSuggestion],
  );

  // ── Public API: reset ─────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(0);
    setActivatedSkillName(null);
    setProcessedText('');
    setSlashStart(0);
  }, []);

  return {
    suggestions,
    isOpen,
    selectedIndex,
    handleInputChange,
    handleKeyDown,
    selectSuggestion,
    processedText,
    activatedSkillName,
    reset,
  };
}
