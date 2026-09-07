import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Flat config. eslint-config-next ships flat configs directly in v16, so there
 * is no FlatCompat shim here.
 *
 * premise.html is the reference prototype, kept in the repo so tests/fidelity
 * can diff the port against it. It is not source to lint.
 */
const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "premise.html"] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
