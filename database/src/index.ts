/**
 * database workspace가 외부에 공개하는 경로 해석 API를 모은다.
 * 실제 DB 작업은 backend의 Store 구현과 migration CLI가 담당한다.
 */

export { resolveSqlitePath } from './env.js';
