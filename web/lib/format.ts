// Number formatting for resource chips (spec story 32): full digits up to 9,999,999, then a
// compact "12.4M" form above that ("1.2B" past 999.9M). The compact form rounds down, like the
// full digits. The exact value goes in a tooltip at the call site.
export function formatResource(value: number): string {
  const n = Math.floor(value);
  if (n <= 9_999_999) return n.toLocaleString('en-US');
  if (n < 1_000_000_000) return `${(Math.floor(n / 100_000) / 10).toFixed(1)}M`;
  return `${(Math.floor(n / 100_000_000) / 10).toFixed(1)}B`;
}
