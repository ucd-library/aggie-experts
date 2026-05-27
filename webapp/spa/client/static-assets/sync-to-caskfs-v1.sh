#!/usr/bin/env bash
# sync-to-caskfs.sh — Sync local static assets into caskfs via the cask CLI.
# Run this after committing changes to the FAQ markdown or images.
#
# Usage:
# cask env set faq-sync -t http -h <host> --path /cask/api
# cask auth login -e faq-sync
# CASKFS_HOST=<host> ./sync-to-caskfs.sh
#
# Environment variables:
#   CASKFS_HOST   caskfs-ui base URL      (default: http://localhost:3001)
#   CASKFS_PATH   API path prefix         (default: /cask/api)
#   CASK_ENV      named cask environment  (default: faq-sync)

set -euo pipefail

CASKFS_HOST="${CASKFS_HOST:-http://localhost:3001}"
CASKFS_PATH="${CASKFS_PATH:-/cask/api}"
CASK_ENV="${CASK_ENV:-faq-sync}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CASK_DEST="/application/webapp/docs"

echo "Syncing static assets to ${CASKFS_HOST}${CASKFS_PATH}"

# Write (or update) the named cask environment for this host
cask env set "$CASK_ENV" -t http -h "$CASKFS_HOST" --path "$CASKFS_PATH"

# Sync faq.md
cask -e "$CASK_ENV" cp "${SCRIPT_DIR}/faq/faq.md" "cask:${CASK_DEST}/faq.md" -x -y

# Sync images directory
cask -e "$CASK_ENV" cp "${SCRIPT_DIR}/faq/images" "cask:${CASK_DEST}/images" -x -y

echo "Sync complete"
