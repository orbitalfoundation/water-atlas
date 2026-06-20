// Small shared formatting helpers (recyclable across projects).
const n = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

export const fmtInt = (v) => (n(v) === null ? '—' : Math.round(n(v)).toLocaleString('en-US'));
export const fmtAf = (v) => (n(v) === null ? '—' : `${fmtInt(v)} AF`);
export const fmtCfs = (v) => (n(v) === null ? '—' : `${fmtInt(v)} cfs`);
export const fmtPct = (v) => (n(v) === null ? '—' : `${n(v)}%`);
