#!/usr/bin/env bash

set -euo pipefail

DOCKER_BIN="${CDK_DOCKER_BIN:-$(command -v docker)}"
SUBCOMMAND="${1:-}"

if [[ -n "$SUBCOMMAND" && "$SUBCOMMAND" == "build" && "${CDK_DOCKER_CACHE:-}" == "gha" && "${GITHUB_ACTIONS:-}" == "true" ]]; then
  shift
  SCOPE="${CDK_DOCKER_CACHE_SCOPE:-cdk-docker}"
  exec "$DOCKER_BIN" buildx build \
    --cache-from "type=gha,scope=${SCOPE}" \
    --cache-to "type=gha,scope=${SCOPE},mode=max" \
    --load \
    "$@"
elif [[ -n "$SUBCOMMAND" ]]; then
  exec "$DOCKER_BIN" "$SUBCOMMAND" "$@"
else
  exec "$DOCKER_BIN"
fi
