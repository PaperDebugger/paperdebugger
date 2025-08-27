#!/bin/bash
mkdir -p logs

# the script is executed by package.json
echo "🧩 Start building Chrome Extension ..."
if ! . ./scripts/env.sh > logs/env.log 2>&1; then
    echo "❌ Failed to get version and revision, please check logs/env.log"
    exit 1
fi

export BETA_BUILD=true
export PD_API_ENDPOINT="http://localhost:6060"

echo "📦 Version: ${VERSION}"
echo "📦 Monorepo Revision: ${MONOREPO_REVISION}"
echo "📦 Beta Build: ${BETA_BUILD}"
echo "📦 API Endpoint: ${PD_API_ENDPOINT}"
echo ""

if ! npm run build > logs/build.log 2>&1; then
    echo "❌ Failed to build Chrome Extension, please check logs/build.log"
    tail -n 10 logs/build.log
    exit 1
fi

echo "✅ Chrome Extension built successfully"
echo "==> check dist/manifest.json for the version"
