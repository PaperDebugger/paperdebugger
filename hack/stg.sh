#!/bin/bash

set -euxo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)
cd $ROOT_DIR

OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://api.openai.com/v1}
OPENAI_API_KEY=${OPENAI_API_KEY:-sk-dummy-OPENAI_API_KEY}
INFERENCE_BASE_URL=${INFERENCE_BASE_URL:-https://inference.paperdebugger.workers.dev}
INFERENCE_API_KEY=${INFERENCE_API_KEY:-sk-dummy-OPEN-ROUTER}
MCP_BASIC_KEY=${MCP_BASIC_KEY:-sk-dummy-MCP_BASIC_KEY}
MCP_PAPERSCORE_KEY=${MCP_PAPERSCORE_KEY:-sk-dummy-MCP_PAPERSCORE_KEY}
XTRAMCP_OPENAI_BASE_URL=${XTRAMCP_OPENAI_BASE_URL:-https://api.openai.com/v1}
XTRAMCP_OPENAI_API_KEY=${XTRAMCP_OPENAI_API_KEY:-sk-dummy-XTRAMCP_OPENAI_API_KEY}
XTRAMCP_OPENREVIEW_BASE_URL=${XTRAMCP_OPENREVIEW_BASE_URL:-https://api2.openreview.net}
XTRAMCP_OPENREVIEW_USERNAME=${XTRAMCP_OPENREVIEW_USERNAME:-dummy-XTRAMCP_OPENREVIEW_USERNAME}
XTRAMCP_OPENREVIEW_PASSWORD=${XTRAMCP_OPENREVIEW_PASSWORD:-dummy-XTRAMCP_OPENREVIEW_PASSWORD}
XTRAMCP_CROSSREF_EMAIL_ADDRESS=${XTRAMCP_CROSSREF_EMAIL_ADDRESS:-dummy-crossref-email-address}
XTRAMCP_DOI_EMAIL_ADDRESS=${XTRAMCP_DOI_EMAIL_ADDRESS:-dummy-doi-email-address}
XTRAMCP_ARXIV_METADATA_DB_URL=${XTRAMCP_ARXIV_METADATA_DB_URL:-postgresql://dummy-arxiv-metadata-db-url}
XTRAMCP_ACL_METADATA_DB_URL=${XTRAMCP_ACL_METADATA_DB_URL:-postgresql://dummy-acl-metadata-db-url}
XTRAMCP_MONGO_URI=${XTRAMCP_MONGO_URI:-mongodb://dummy-mongo-uri}
PAPERDEBUGGER_IMAGE=${PAPERDEBUGGER_IMAGE:-ghcr.io/paperdebugger/sharelatex-paperdebugger:latest}
MONGO_URI=${MONGO_URI:-}
GHCR_DOCKER_CONFIG=${GHCR_DOCKER_CONFIG:-dummy-ghcr-docker-config}
CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:-dummy-cloudflare-tunnel-token}

helm template $ROOT_DIR/helm-chart \
    --create-namespace \
    --values $ROOT_DIR/helm-chart/values.yaml \
    --values $ROOT_DIR/hack/values-stg.yaml \
    --set-string openai_base_url=$OPENAI_BASE_URL \
    --set-string openai_api_key=$OPENAI_API_KEY \
    --set-string inference_base_url=$INFERENCE_BASE_URL \
    --set-string inference_api_key=$INFERENCE_API_KEY \
    --set-string mcp_basic_key=$MCP_BASIC_KEY \
    --set-string mcp_paperscore_key=$MCP_PAPERSCORE_KEY \
    --set-string xtramcp_openai_base_url=$XTRAMCP_OPENAI_BASE_URL \
    --set-string xtramcp_openai_api_key=$XTRAMCP_OPENAI_API_KEY \
    --set-string xtramcp_openreview_base_url=$XTRAMCP_OPENREVIEW_BASE_URL \
    --set-string xtramcp_openreview_username=$XTRAMCP_OPENREVIEW_USERNAME \
    --set-string xtramcp_openreview_password=$XTRAMCP_OPENREVIEW_PASSWORD \
    --set-string xtramcp_crossref_email_address=$XTRAMCP_CROSSREF_EMAIL_ADDRESS \
    --set-string xtramcp_doi_email_address=$XTRAMCP_DOI_EMAIL_ADDRESS \
    --set-string xtramcp_acl_metadata_db_url=$XTRAMCP_ACL_METADATA_DB_URL \
    --set-string xtramcp_arxiv_metadata_db_url=$XTRAMCP_ARXIV_METADATA_DB_URL \
    --set-string xtramcp_mongo_uri=$XTRAMCP_MONGO_URI \
    --set-string paperdebugger.image=$PAPERDEBUGGER_IMAGE \
    --set-string mongo.uri=$MONGO_URI \
    --set-string ghcr_docker_config=$GHCR_DOCKER_CONFIG \
    --set-string cloudflare_tunnel_token=$CLOUDFLARE_TUNNEL_TOKEN
