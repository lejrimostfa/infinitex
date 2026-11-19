// infinitex/perf: fewer draws (batch.js) and what a frame costs (audit.js).
// The command line tool bin/infinitex-perf.mjs runs the audit on a page; the
// skill skills/infinitex-optimize/SKILL.md applies the fixes one by one.
export { createInstances, skinParts } from './batch.js';
export { auditFrame } from './audit.js';
