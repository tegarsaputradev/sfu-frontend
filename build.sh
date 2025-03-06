#!/bin/bash

# Check if the environment is passed as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 {dev|prod}"
  exit 1
fi

ENVIRONMENT=$1

# Define image tag based on environment
if [ "$ENVIRONMENT" == "dev" ]; then
  IMAGE_TAG="sfu:dev"
  TARGET="dev"
elif [ "$ENVIRONMENT" == "prod" ]; then
  IMAGE_TAG="sfu:prod"
  TARGET="prod"
else
  echo "Unknown environment: $ENVIRONMENT"
  exit 1
fi

# Build the Docker image
docker build -t $IMAGE_TAG --target $TARGET .

echo "$IMAGE_TAG has been built."