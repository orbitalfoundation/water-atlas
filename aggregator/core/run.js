// Runs a single source under a consistent policy: log boundaries, persist watermark + status,
// and isolate failures so one bad source never aborts the others.
export async function runSource(source, ctx) {
  const { log, state } = ctx;
  const started = Date.now();
  log.info(`▶ ${source.id} — ${source.title}`);
  try {
    const result = (await source.run(ctx)) || {};
    state.write(source.id, { cursor: result.cursor ?? ctx.cursor, status: 'ok', stats: result.stats });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    log.ok(`✔ ${source.id} ok in ${secs}s ${result.stats ? JSON.stringify(result.stats) : ''}`);
    return result;
  } catch (err) {
    state.write(source.id, { cursor: ctx.cursor, status: 'error', stats: { error: err.message } });
    log.error(`✘ ${source.id} failed: ${err.message}`);
    return { error: err };
  }
}
