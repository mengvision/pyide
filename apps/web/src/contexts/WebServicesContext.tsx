/**
 * WebServicesContext
 *
 * Provides data from the web-specific service hooks (useWebChat, useWebSkills,
 * useWebMCP, useWebMemory) to any component in the tree.
 *
 * Usage:
 *   <WebServicesProvider token={token}>
 *     <YourComponents />
 *   </WebServicesProvider>
 *
 * Access inside components:
 *   const { skills, toggleSkill } = useWebServices().webSkills;
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useWebSkills } from '../hooks/useWebSkills';
import { useWebMCP } from '../hooks/useWebMCP';
import { useWebMemory } from '../hooks/useWebMemory';
import type { UseWebSkillsReturn } from '../hooks/useWebSkills';
import type { UseWebMCPReturn } from '../hooks/useWebMCP';
import type { UseWebMemoryReturn } from '../hooks/useWebMemory';

// ── Re-export hook return types so consumers can import from here ─────────────
export type { UseWebSkillsReturn, UseWebMCPReturn, UseWebMemoryReturn };

// We need to export the return types from the hooks — re-export them:
export type { LoadedSkill } from '../hooks/useWebSkills';
export type { MCPServerListItem } from '../hooks/useWebMCP';
export type { MemoryEntry, DreamStatus } from '../hooks/useWebMemory';

// ── Hook return types (declared inline to avoid import cycle issues) ──────────

interface WebServicesContextValue {
  token: string | null;
  webSkills: ReturnType<typeof useWebSkills>;
  webMCP: ReturnType<typeof useWebMCP>;
  webMemory: ReturnType<typeof useWebMemory>;
}

const WebServicesContext = createContext<WebServicesContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface WebServicesProviderProps {
  token: string | null;
  children: React.ReactNode;
}

export function WebServicesProvider({
  token,
  children,
}: WebServicesProviderProps) {
  const webSkills = useWebSkills({ token });
  const webMCP = useWebMCP({ token });
  const webMemory = useWebMemory({ token });

  const value = useMemo<WebServicesContextValue>(
    () => ({ token, webSkills, webMCP, webMemory }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, webSkills, webMCP, webMemory],
  );

  return (
    <WebServicesContext.Provider value={value}>
      {children}
    </WebServicesContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useWebServices(): WebServicesContextValue {
  const ctx = useContext(WebServicesContext);
  if (!ctx) {
    throw new Error('useWebServices must be used within a WebServicesProvider');
  }
  return ctx;
}
