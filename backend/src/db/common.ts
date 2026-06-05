import fs from 'node:fs';
import path from 'node:path';
import type { MessageRecord, Role, SessionMachineState } from '@turinglet/shared';

export function mapState(userTyping: boolean, intensity: number): SessionMachineState {
  if (userTyping) return 'user_typing';
  if (intensity >= 7) return 'high_emotional_load';
  return 'idle';
}

export function parseMetadata(metadataJson: string | null): Record<string, unknown> | undefined {
  if (!metadataJson) return undefined;
  try {
    return JSON.parse(metadataJson) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

// Runtime commands can start from a workspace package folder. This walk keeps
// relative SQLite paths anchored to the repository root instead of cwd drift.
export function findRepoRoot(startDir: string): string {
  let dir = startDir;

  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (parsed.name === 'turinglet') return dir;
      } catch {
        // Keep walking upward when a package file is malformed or unreadable.
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

export function toMessageRecord(row: {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  eventType: 'append';
  metadataJson: string | null;
  createdAtMs: number;
}): MessageRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    eventType: row.eventType,
    metadata: parseMetadata(row.metadataJson),
    createdAt: new Date(row.createdAtMs).toISOString()
  };
}
