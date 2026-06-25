import fs from 'node:fs';
import path from 'node:path';

function findRepoRoot(startDir: string): string {
  let dir = startDir;

  for (;;) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const parsed = JSON.parse(raw) as { name?: string };
        if (parsed.name === 'turinglet') {
          return dir;
        }
      } catch {
        // Continue searching parent directories.
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}

/**
 * `SQLITE_PATH`를 저장소 루트 기준 절대 경로로 해석한다.
 * 환경 변수가 없으면 `./database/local-dev.db`를 사용하며 파일은 생성하지 않는다.
 */
export function resolveSqlitePath(): string {
  const envPath = process.env.SQLITE_PATH ?? './database/local-dev.db';
  if (path.isAbsolute(envPath)) return envPath;

  const repoRoot = findRepoRoot(process.cwd());
  return path.resolve(repoRoot, envPath);
}
