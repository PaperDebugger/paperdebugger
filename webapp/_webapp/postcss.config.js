// ponytail: scope ALL css under .pd-scope ONLY for the content-script build
// (VITE_CONFIG=default) so preflight/heroui don't leak into Overleaf. The
// .pd-scope class sits on every container we mount into (#paper-debugger-root
// and #pd-embed-sidebar). Settings/popup are standalone pages and stay unscoped.
const SCOPE = ".pd-scope";
const scoped = process.env.VITE_CONFIG === "default";

export default {
  plugins: {
    tailwindcss: {},
    ...(scoped && {
      "postcss-prefix-selector": {
        prefix: SCOPE,
        transform(prefix, selector, prefixedSelector) {
          // Root-level globals apply to the scope container itself.
          if (selector === "html" || selector === "body" || selector === ":root") return prefix;
          // box-sizing/* reset: cover the scope element and everything inside it.
          if (selector === "*") return `${prefix}, ${prefix} *`;
          // Theme toggles + :root variants live ON the scope element → compound, not descendant.
          if (/^\.(dark|light)\b/.test(selector)) return prefix + selector;
          if (selector.startsWith(":root")) return prefix + selector.slice(":root".length);
          if (selector.startsWith("[data-theme")) return prefix + selector;
          // These elements ARE scope roots (carry .pd-scope on themselves) → compound,
          // so rules targeting the element itself keep matching after scoping.
          if (
            selector.startsWith("#pd-embed-sidebar") ||
            selector.startsWith("#paper-debugger-root") ||
            selector.startsWith(".pd-rnd")
          ) {
            return prefix + selector;
          }
          return prefixedSelector;
        },
      },
    }),
    autoprefixer: {},
  },
};
