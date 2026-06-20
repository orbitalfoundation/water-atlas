// Per-source watermark store. Lets a run *resume* instead of *restart*:
// sources persist a cursor (pagination token, last observed date) between invocations.
export function makeState(db) {
  const read = db.prepare('SELECT * FROM source_state WHERE source = ?');
  const write = db.prepare(`
    INSERT INTO source_state (source, cursor, last_run_at, last_status, stats)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET
      cursor = excluded.cursor, last_run_at = excluded.last_run_at,
      last_status = excluded.last_status, stats = excluded.stats`);

  return {
    read: (source) => read.get(source) || null,
    write: (source, { cursor = null, status = null, stats = null } = {}) =>
      write.run(source, cursor, new Date().toISOString(), status,
        stats ? JSON.stringify(stats) : null),
  };
}
