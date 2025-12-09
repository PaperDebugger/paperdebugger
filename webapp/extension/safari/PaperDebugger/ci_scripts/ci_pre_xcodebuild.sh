#!/bin/zsh

echo "🧩 Stage: PRE-Xcode Build is activated .... "

set -e
# debug log
set -x

export N_PREFIX=~/.n
export PATH=$N_PREFIX/bin:$PATH

# Determine architecture and set Node.js download URL accordingly
NODE_VERSION="v22.4.0" # Updated from v22.16.0 which is not a valid version
CPU_ARCH=$(uname -m)
NODE_DIST_ARCH=""

if [[ "$CPU_ARCH" == "arm64" ]]; then
  NODE_DIST_ARCH="darwin-arm64"
elif [[ "$CPU_ARCH" == "x86_64" ]]; then
  NODE_DIST_ARCH="darwin-x64"
else
  echo "Unsupported architecture: $CPU_ARCH"
  exit 1
fi

NODE_DIST_NAME="node-${NODE_VERSION}-${NODE_DIST_ARCH}"
export PATH="$PWD/${NODE_DIST_NAME}/bin:$PATH"

cd ../../../
ls -la
npm run build:prd:safari

echo "🎯 Stage: PRE-Xcode Build is DONE .... "

exit 0
