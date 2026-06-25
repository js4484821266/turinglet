/**
 * 현재 대화 생성 provider를 조립 지점에 노출하는 adapter 진입점이다.
 * mock fallback 없이 로컬 Hugging Face 호환 서버 adapter만 생성한다.
 */

import { HuggingFaceLocalProvider } from './hfLocalProvider.js';

export function createProvider(): HuggingFaceLocalProvider {
  return new HuggingFaceLocalProvider();
}
