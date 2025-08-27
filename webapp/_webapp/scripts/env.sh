#!/bin/bash

# the script is executed by package.json
export VERSION=$(git describe --tags --match 'v*' --abbrev=0)
export VERSION="${VERSION#v}"
export MONOREPO_REVISION=$(git rev-parse HEAD | cut -c1-6)
