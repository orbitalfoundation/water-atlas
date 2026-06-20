// Tiny leveled logger. Writes to stderr so stdout stays clean for piping data.
const COLOR = { info: '', warn: '\x1b[33m', error: '\x1b[31m', ok: '\x1b[32m', dim: '\x1b[2m' };
const RESET = '\x1b[0m';
const stamp = () => new Date().toISOString().slice(11, 19);

export function makeLog(scope) {
  const tag = scope ? `[${scope}] ` : '';
  const emit = (level, msg) =>
    process.stderr.write(`${COLOR[level] || ''}${stamp()} ${tag}${msg}${RESET}\n`);
  return {
    info: (m) => emit('info', m),
    warn: (m) => emit('warn', m),
    error: (m) => emit('error', m),
    ok: (m) => emit('ok', m),
    dim: (m) => emit('dim', m),
  };
}
