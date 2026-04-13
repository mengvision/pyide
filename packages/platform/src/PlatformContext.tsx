/**
 * React context that provides the active PlatformService instance to
 * all components in the tree.
 */

import React, { createContext, useContext } from 'react';
import type { PlatformService } from './PlatformService';

const PlatformContext = createContext<PlatformService | null>(null);

interface PlatformProviderProps {
  platform: PlatformService;
  children: React.ReactNode;
}

/** Wrap your app with this provider to make the platform available everywhere. */
export const PlatformProvider: React.FC<PlatformProviderProps> = ({ platform, children }) => (
  <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>
);

/**
 * Access the active PlatformService instance.
 * Must be used inside a <PlatformProvider>.
 */
export function usePlatform(): PlatformService {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error('usePlatform must be used within a <PlatformProvider>');
  }
  return ctx;
}
