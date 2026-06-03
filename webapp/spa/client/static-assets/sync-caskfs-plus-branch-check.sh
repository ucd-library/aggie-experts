#!/usr/bin/env bash
# sync-caskfs-static-assets.sh — Sync local static assets into caskfs via the cask CLI.
# Run this after committing changes to the FAQ markdown or images.
#
# Usage:
#   ./sync-caskfs-static-assets.sh           # local dev (no branch check)
#   ./sync-caskfs-static-assets.sh dev       # dev env  (must be on 'dev' branch)
#   ./sync-caskfs-static-assets.sh prod      # prod env (must be on 'main' branch)
#
# Environment variables (all optional):
#   CASKFS_HOST   override caskfs-ui base URL
#   CASKFS_PATH   override API path prefix    (default: /cask/api)
#   CASK_ENV      named cask environment      (default: faq-sync)

set -euo pipefail

ENV="${1:-}"
CASKFS_PATH="${CASKFS_PATH:-/cask/api}"
CASK_ENV="${CASK_ENV:-faq-sync}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CASK_DEST="/application/webapp/docs"

# Resolve host and required branch based on ENV argument
case "$ENV" in
  dev)
    REQUIRED_BRANCH="dev"
    CASKFS_HOST="${CASKFS_HOST:-https://anduin-dev.experts.library.ucdavis.edu}"
    ;;
  prod)
    REQUIRED_BRANCH="main"
    CASKFS_HOST="${CASKFS_HOST:-https://experts-anduin.library.ucdavis.edu}"
    ;;
  "")
    REQUIRED_BRANCH=""
    CASKFS_HOST="${CASKFS_HOST:-http://localhost:3001}"
    ;;
  *)
    echo "Error: unknown environment '${ENV}'. Use 'dev', 'prod', or omit for local."
    exit 1
    ;;
esac

# Branch check for remote environments
if [ -n "$REQUIRED_BRANCH" ]; then
  CURRENT_BRANCH="$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  if [ "$CURRENT_BRANCH" != "$REQUIRED_BRANCH" ]; then
    echo "Error: must be on the '${REQUIRED_BRANCH}' branch to sync to ${ENV} (currently on '${CURRENT_BRANCH}')."
    exit 1
  fi
fi

echo "Syncing static assets to ${CASKFS_HOST}${CASKFS_PATH}"

# For local dev, always write the env config (no auth needed).
# For remote envs, only create the config if it doesn't already exist so
# that a pre-saved auth token is not overwritten.
if [ -z "$ENV" ] || ! cask env get "$CASK_ENV" &>/dev/null; then
  cask env set "$CASK_ENV" -t http -h "$CASKFS_HOST" --path "$CASKFS_PATH"
fi

# Sync faq.md
cask -e "$CASK_ENV" cp "${SCRIPT_DIR}/faq/faq.md" "cask:${CASK_DEST}/faq.md" -x -y

# Sync images directory
cask -e "$CASK_ENV" cp "${SCRIPT_DIR}/faq/images" "cask:${CASK_DEST}/images" -x -y

echo "Sync complete"
