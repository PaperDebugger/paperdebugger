# Browser Extension

supports both chrome and safari.

```bash
npm install

# first, build the chrome version
VERSION=$(git describe --tags --match "v*" --abbrev=0) MONOREPO_REVISION=$(git rev-parse HEAD | cut -c1-6) BETA_BUILD=false PD_API_ENDPOINT=https://app.paperdebugger.com npm run build

# convert to safari version (optional)
mkdir safari && cd safari
xcrun safari-web-extension-converter ../dist
```

## Development

```bash
npm install

npm run dev:chat
```
