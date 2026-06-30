import prefixSelector from "postcss-prefix-selector";

// Isolate the injected UI from Overleaf by scoping every rule in pd.css under
// #paper-debugger-root (the React root the drawer is portaled into). No shadow
// DOM — the id prefix is enough, and keeps us in the host's DOM tree.
const SCOPE = "#paper-debugger-root";

export default {
  plugins: [
    prefixSelector({
      prefix: SCOPE,
      includeFiles: [/pd\.css/],
      transform(prefix, selector, prefixedSelector) {
        // Anchor root-level selectors (Tailwind preflight + @theme tokens) on
        // the scope element itself instead of a descendant.
        if ([":root", ":host", "html", "body"].includes(selector)) return prefix;
        return prefixedSelector;
      },
    }),
  ],
};
