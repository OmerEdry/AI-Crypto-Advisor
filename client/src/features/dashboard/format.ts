// One rule, stated: **at or above a dollar, two decimal places; below it, four significant
// digits.** Bitcoin reads $62,951.00 and Shiba Inu $0.00001230, and neither needs a different
// rule to look right. Fixed decimals cannot do both — two places renders sub-cent coins as
// $0.00, and six places gives a four-figure coin four digits of noise that widen the column
// past every neighbour.
export function formatPrice(price: number): string {
  const precision: Intl.NumberFormatOptions =
    price >= 1
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumSignificantDigits: 4 };

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    ...precision,
  }).format(price);
}

export function formatPercent(change: number): string {
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

// Both callers carry a calendar date rather than an instant: the curated feed sends `2026-08-14`
// with no time at all, and the insight's `forDate` is a UTC calendar day by design (§17). Either
// one parsed as a local instant renders as the previous day for every reader behind UTC — a
// dashboard quietly dated yesterday. The day is taken verbatim and formatted in UTC, so it reads
// the same everywhere.
export function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
