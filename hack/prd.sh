#!/bin/bash

set -euxo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)
cd $ROOT_DIR

OPENAI_API_KEY=${OPENAI_API_KEY:-sk-dummy-OPENAI_API_KEY}
MCP_BASIC_KEY=${MCP_BASIC_KEY:-sk-dummy-MCP_BASIC_KEY}
MCP_PAPERSCORE_KEY=${MCP_PAPERSCORE_KEY:-sk-dummy-MCP_PAPERSCORE_KEY}
PAPERDEBUGGER_IMAGE=${PAPERDEBUGGER_IMAGE:-ghcr.io/paperdebugger/sharelatex-paperdebugger:latest}
MONGO_URI=${MONGO_URI:-}
GHCR_DOCKER_CONFIG=${GHCR_DOCKER_CONFIG:-dummy-ghcr-docker-config}
CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:-dummy-cloudflare-tunnel-token}

helm template $ROOT_DIR/helm-chart \
    --create-namespace \
    --values $ROOT_DIR/helm-chart/values.yaml \
    --values $ROOT_DIR/hack/values-prd.yaml \
    --set-string openai_api_key=$OPENAI_API_KEY \
    --set-string mcp_basic_key=$MCP_BASIC_KEY \
    --set-string mcp_paperscore_key=$MCP_PAPERSCORE_KEY \
    --set-string paperdebugger.image=$PAPERDEBUGGER_IMAGE \
    --set-string mongo.uri=$MONGO_URI \
    --set-string ghcr_docker_config=$GHCR_DOCKER_CONFIG \
    --set-string cloudflare_tunnel_token=$CLOUDFLARE_TUNNEL_TOKEN
