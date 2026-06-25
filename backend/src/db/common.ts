import fs from 'node:fs';
import path from 'node:path';
import type { MessageRecord, Role, SessionMachineState } from '@turinglet/shared';

export function mapState(userTyping: boolean, intensity: number): SessionMachineState {
  if (userTyping) return 'user_typing';
  if (intensity >= 7) return 'high_emotional_load';
  return 'idle';
}

/**
 * DB의 nullable JSON 문자열을 메시지 metadata 객체로 복원한다.
 * 빈 값이나 손상된 JSON은 metadata가 없다는 뜻의 `undefined`로 처리한다.
 */
export function parseMetadata(metadataJson: string | null): Record<string, unknown> | undefined {
  if (!metadataJson) return undefined;
  try {
    return JSON.parse(metadataJson) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * workspace 하위에서 시작해 이름이 `turinglet`인 루트 package를 찾는다.
 *
 * @param startDir 탐색을 시작할 디렉터리
 * @returns 저장소 루트. 찾지 못하면 원래 `startDir`을 반환한다.
 * @remarks 읽을 수 없는 package.json은 건너뛰며 파일 시스템을 변경하지 않는다.
 */
export function findRepoRoot(startDir: string): string {
  let dir = startDir;

  for (;;) {
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

/**
 * DB 조회 행을 패키지 공통 `MessageRecord`로 변환한다.
 * epoch millisecond는 ISO 문자열로, metadata JSON 오류는 `undefined`로 바뀐다.
 */
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
