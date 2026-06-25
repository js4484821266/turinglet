/**
 * 서버의 ISO 생성 시각을 한국어 화면 표시 문자열로 변환한다.
 * 파싱할 수 없는 값은 원문을 반환해 메시지 렌더링 자체가 중단되지 않게 한다.
 */

export function formatTimestamp(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return createdAt;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}년 ${pad(d.getMonth() + 1)}월 ${pad(d.getDate())}일 ${pad(
    d.getHours()
  )}시 ${pad(d.getMinutes())}분 ${pad(d.getSeconds())}초`;
}
