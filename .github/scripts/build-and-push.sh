#!/usr/bin/env bash
set -euo pipefail

REGISTRY=${REGISTRY:-ghcr.io}
IMAGE_NAME=${IMAGE_NAME:-}
TOKEN=${GITHUB_TOKEN:-}
ACTOR=${GITHUB_ACTOR:-github-actions[bot]}
SHA=${GITHUB_SHA:-}

if [[ -z "$IMAGE_NAME" ]]; then
  echo "IMAGE_NAME environment variable is required" >&2
  exit 1
fi

if [[ -z "$SHA" ]]; then
  SHA=$(git rev-parse HEAD)
fi

if [[ -z "$TOKEN" ]]; then
  echo "GITHUB_TOKEN environment variable is required" >&2
  exit 1
fi

echo "$TOKEN" | docker login "$REGISTRY" -u "$ACTOR" --password-stdin

declare -a TAG_LIST
SHORT_SHA=${SHA:0:12}
TAG_LIST+=("${REGISTRY}/${IMAGE_NAME}:${SHORT_SHA}")

TAG_LIST+=("${REGISTRY}/${IMAGE_NAME}:latest")

echo "Building image with tags:"
for tag in "${TAG_LIST[@]}"; do
  echo "  $tag"
done

declare -a TAG_ARGS
for tag in "${TAG_LIST[@]}"; do
  TAG_ARGS+=("--tag" "$tag")
done

docker build \
  "${TAG_ARGS[@]}" \
  .

echo "Pushing image tags:"
for tag in "${TAG_LIST[@]}"; do
  echo "  $tag"
  docker push "$tag"
done

