/**
 * Skill Lock File Manager
 * Manages ~/.pyide/.skill-lock.json which tracks installed skills.
 */

import type { PlatformService } from '@pyide/platform';

export interface LockedSkill {
  name: string;
  version: string;
  source: 'bundled' | 'disk' | 'clawhub' | 'plugin' | 'managed';
  url?: string;
  integrity?: string;
  installed_at: string;
}

export interface SkillLockFile {
  version: 1;
  skills: LockedSkill[];
}

const LOCK_FILE_SUBPATH = '.pyide/.skill-lock.json';

// Platform instance shared via initSkillPlatform() in index.ts
let _platform: PlatformService | null = null;

/** Called by index.ts initSkillPlatform — shares the same platform reference. */
export function setLockFilePlatform(platform: PlatformService) {
  _platform = platform;
}

function requirePlatform(): PlatformService {
  if (!_platform) throw new Error('SkillService lockfile: platform not initialized');
  return _platform;
}

async function getLockFilePath(): Promise<string> {
  const homeDir = await requirePlatform().file.getHomeDir();
  return `${homeDir}/${LOCK_FILE_SUBPATH}`;
}

/** Read the lock file from disk. Returns an empty lock file if missing. */
export async function readLockFile(): Promise<SkillLockFile> {
  try {
    const platform = requirePlatform();
    const path = await getLockFilePath();
    const content = await platform.file.read(path);
    const parsed = JSON.parse(content);
    // Normalise older formats that lacked a version field
    return { version: 1, skills: parsed.skills ?? parsed ?? [] };
  } catch {
    return { version: 1, skills: [] };
  }
}

/** Write the lock file to disk. */
export async function writeLockFile(lockFile: SkillLockFile): Promise<void> {
  const platform = requirePlatform();
  const path = await getLockFilePath();
  await platform.file.write(path, JSON.stringify(lockFile, null, 2));
}

/**
 * Add or update a skill entry in the lock file.
 * If a skill with the same name already exists it is replaced.
 */
export async function addToLockFile(skill: LockedSkill): Promise<void> {
  const lockFile = await readLockFile();
  lockFile.skills = lockFile.skills.filter(s => s.name !== skill.name);
  lockFile.skills.push(skill);
  await writeLockFile(lockFile);
}

/** Remove a skill entry from the lock file by name. */
export async function removeFromLockFile(name: string): Promise<void> {
  const lockFile = await readLockFile();
  lockFile.skills = lockFile.skills.filter(s => s.name !== name);
  await writeLockFile(lockFile);
}

/** Return the lock file entry for a skill, or undefined if not installed. */
export async function getLockedSkill(name: string): Promise<LockedSkill | undefined> {
  const lockFile = await readLockFile();
  return lockFile.skills.find(s => s.name === name);
}
