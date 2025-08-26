#!/bin/zsh

# fail if any command fails

echo "🧩 Stage: Post-clone is activated .... "

echo "🧩 Stage: Fetching tags .... "
git fetch --tags
echo "🧩 Stage: Fetching tags done .... "

set -e
# debug log
set -x

# Install dependencies using Homebrew. This is MUST! Do not delete.

export N_PREFIX=~/.n
export PATH=$N_PREFIX/bin:$PATH

brew install --quiet n
n lts
node -v

cd ../../../
ls -la

npm install

echo "🎯 Stage: Post-clone is done .... "

exit 0
