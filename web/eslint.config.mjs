import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Node scripts (CommonJS / one-off tooling) — not app code.
    "scripts/**",
  ]),
  {
    rules: {
      // Mount/sync effects that call setState are normal for this app (prefs,
      // bridge polling, localStorage hydrate). The React Compiler rule is too
      // strict here and flags every legitimate data-load effect.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
