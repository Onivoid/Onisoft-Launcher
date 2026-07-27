#!/usr/bin/env bash
# Thin wrapper kept for manual runs; prefer: node scripts/setup-hooks.mjs
set -e
node "$(dirname "$0")/setup-hooks.mjs"
