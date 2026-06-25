/**
 * 환경 설정에 따라 SQLite 또는 PostgreSQL Store를 선택한다.
 * PostgreSQL URL 누락은 시작 시 명시적 설정 오류로 처리한다.
 */

import { config } from '../config.js';
import { PostgresStore, SqliteStore, type Store } from './store.js';

export function createStore(): Store {
  if (config.dbProvider === 'postgres') {
    if (!config.postgresUrl) {
      throw new Error('POSTGRES_URL must be set when DB_PROVIDER=postgres');
    }
    return new PostgresStore(config.postgresUrl);
  }
  return new SqliteStore(config.sqlitePath);
}
