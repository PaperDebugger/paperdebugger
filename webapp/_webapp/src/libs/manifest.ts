import manifestJSON from "../manifest.json";
import semver from "semver";

export function getManifest() {
  // if MONOREPO_REVISION is not set, use git rev-parse HEAD | cut -c1-6
  const monorepoRevision = process.env.MONOREPO_REVISION;
  const betaBuild = process.env.BETA_BUILD;
  const version = process.env.VERSION;

  // This is the version on github tag.
  manifestJSON.version = semver.clean(version || "") || "0.0.0";

  if (betaBuild === "true") {
    manifestJSON.version_name = `v${manifestJSON.version}-${monorepoRevision}-beta`;
    manifestJSON.name = "PaperDebugger BETA";
    manifestJSON.description = "THIS EXTENSION IS FOR BETA TESTING";
    manifestJSON.key =
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAujSCga4E319Ui1tNqPBpmDo3ytX5liUrS9tkkKkpSHsYfqbzROtXd1khnQzdOlhSsWR3obshJJ4u/J7G8464EU6aHiVbwiL7/wo9rZaK0x1VSUMRLRrcrqPYJpauoOcSq/ImWuylTVuNBmKzpf6nEHBPWXLUKiIxuvKKXCGrrvkivTIRT/G0abn+TQSz0JpbX4qIUYy5YmGXDwBhSkR4bw5wLIzctCHdUHlV5hjEGKEIC1nzBwYtMXm0j+hi+66neakVM+fmz+l/1WT4H//U1ml0in9UIVnNpGuwGxbLuD4MqwC3er+UTs5ojOQEqmoLItk4EK4hdOX0oijHGwY+SwIDAQAB";
  } else {
    manifestJSON.version_name = `v${manifestJSON.version}-${monorepoRevision}`;
    manifestJSON.name = "PaperDebugger";
    manifestJSON.description = "AI assistant for writing better papers.";
    manifestJSON.key =
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA551W5cYpoDBMQLSFFrGBzjcCyMtYx9NY6GEZeUzjy+fZSV9fOO4XFqw9sftHgv2MlEyruysvroexh0EJCbtasnaM1v+wwZDYNT7WVdauPJLblqpk/XAz2pyx4IQFhronvSpbtoVGDnUEB0LYZSRsKvP+ddB7ZVB9PMag7vWed+ATTKi6nRMkxzVW8Hu9iIMSiqI3vHoKvE4aEeIyZnrMMKxXzcR7+hsQzWpygDvbkwehL4oR64VleggWLlvkUEpNM/gFDL9bO9lFeAq//NZ41CoJGaQvJEdMwCh5765wgS5ibL0RcRUYLS/FxP8IR9lVT/6nBjVT+nVQ1CYavd5u6wIDAQAB";
  }

  return manifestJSON;
}
