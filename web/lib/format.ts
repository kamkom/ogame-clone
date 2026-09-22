// Number formatting for resource chips (spec story 32): full digits up to 9,999,999, then a
// compact "12.4M" form above that. The exact value goes in a tooltip at the call site.
export function formatResource(value: number): string {
  const n = Math.floor(value);
  if (n <= 9_999_999) return n.toLocaleString('en-US');
  return `${(n / 1_000_000).toFixed(1)}M`;
}
