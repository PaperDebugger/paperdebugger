#!/bin/bash

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." &>/dev/null && pwd)
cd $ROOT_DIR

git diff --name-only main $(git rev-parse --abbrev-ref HEAD) | sed 's|/.*||' | sort -u
