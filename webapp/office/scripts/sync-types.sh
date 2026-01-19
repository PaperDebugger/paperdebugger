#!/bin/bash
# Sync shared adapter types from paperdebugger webapp
#
# Usage: ./scripts/sync-types.sh
#
# This script copies the types.ts from the webapp to ensure
# both repositories use identical interface definitions.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADDIN_ROOT="$(dirname "$SCRIPT_DIR")"
WEBAPP_ROOT="${ADDIN_ROOT}/../paperdebugger/webapp/_webapp"

SOURCE_FILE="${WEBAPP_ROOT}/src/adapters/types.ts"
TARGET_FILE="${ADDIN_ROOT}/src/adapters/types.ts"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "Error: Source file not found: $SOURCE_FILE"
  echo "Make sure paperdebugger webapp is at the expected location."
  exit 1
fi

echo "Syncing types from webapp..."
echo "  Source: $SOURCE_FILE"
echo "  Target: $TARGET_FILE"

# Copy with header modification
{
  echo "/**"
  echo " * Adapter Type Definitions"
  echo " *"
  echo " * ⚠️  AUTO-SYNCED FROM WEBAPP - DO NOT EDIT DIRECTLY"
  echo " *"
  echo " * This file is synced from paperdebugger webapp."
  echo " * To make changes, edit the source file in webapp and run:"
  echo " *   ./scripts/sync-types.sh"
  echo " *"
  echo " * Source: paperdebugger/webapp/_webapp/src/adapters/types.ts"
  echo " * Last synced: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo " */"
  echo ""
  # Skip the original header comment and copy the rest
  sed -n '/^\/\/ ====/,$p' "$SOURCE_FILE"
} > "$TARGET_FILE"

echo "✓ Types synced successfully!"
