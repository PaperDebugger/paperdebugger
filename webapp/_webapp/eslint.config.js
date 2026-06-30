import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: [".output", ".wxt", "node_modules", "dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // TypeScript already resolves identifiers, including WXT auto-imports
      // (`browser`, `defineUnlistedScript`, …); the core rule only false-positives.
      "no-undef": "off",
      // New, opinionated perf hint — fires on the standard "load async data on
      // mount" pattern. Keep it visible, not blocking.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
);
