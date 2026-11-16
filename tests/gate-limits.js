// Thresholds and camera heights of the quality gate, shared by
// tests/run-gate.mjs (the knit demo) and bin/infinitex-check.mjs (any family).
export const HEIGHTS = [ 0.5, 0.25, 0.12, 0.06, 0.03, 0.015, 0.008, 0.004, 0.002, 0.001 ];
export const LIMITS = { meanShift: 0.05, shimmer: 1.6, sheen: 0.1 };
