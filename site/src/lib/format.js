// Small shared formatting helpers (recyclable across projects).
const n = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

export const fmtInt = (v) => (n(v) === null ? '—' : Math.round(n(v)).toLocaleString('en-US'));
export const fmtAf = (v) => (n(v) === null ? '—' : `${fmtInt(v)} AF`);
export const fmtCfs = (v) => (n(v) === null ? '—' : `${fmtInt(v)} cfs`);
export const fmtPct = (v) => (n(v) === null ? '—' : `${n(v)}%`);

export function fmtFlowLabel(cfs) {
  const v = n(cfs);
  if (v === null) return 'No reading';
  if (v <= 0) return 'Dry';
  if (v < 10) return 'Trickle';
  if (v < 100) return 'Low';
  if (v < 1000) return 'Moderate';
  if (v < 10000) return 'Strong';
  return 'Torrent';
}
