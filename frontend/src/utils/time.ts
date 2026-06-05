export function formatTimestamp(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return createdAt;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}년 ${pad(d.getMonth() + 1)}월 ${pad(d.getDate())}일 ${pad(
    d.getHours()
  )}시 ${pad(d.getMinutes())}분 ${pad(d.getSeconds())}초`;
}
