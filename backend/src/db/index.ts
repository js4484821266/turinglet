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
