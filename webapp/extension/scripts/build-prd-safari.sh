#!/bin/bash
mkdir -p logs

# the script is executed by package.json
echo "🧩 Start building Safari Extension .... "
if ! . ./scripts/env.sh > logs/env.log 2>&1; then
    echo "❌ Failed to get version and revision, please check logs/env.log"
    exit 1
fi
export SAFARI_BUILD=true

echo "📦 Version: ${VERSION}"
echo "📦 Monorepo Revision: ${MONOREPO_REVISION}"
echo ""

# set safari version
sed -i '' "s/MARKETING_VERSION = .*/MARKETING_VERSION = \"${VERSION}\";/" safari/PaperDebugger/PaperDebugger.xcodeproj/project.pbxproj

echo "🧩 Step [1/2] Building dependent extensions .... "
if ! npm run build:prd:chrome > logs/build-prd-chrome.log 2>&1; then
    echo "❌ Failed to build dependent extensions, please check logs/build-prd-chrome.log"
    exit 1
fi

echo "🧩 Step [2/2] Building Safari Extension .... "

echo "==> Please then open XCode, build and distribute"
