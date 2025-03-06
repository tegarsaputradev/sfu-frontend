#!/bin/bash

# Check if the environment is passed as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 {dev|prod}"
  exit 1
fi

# Assign the environment
ENVIRONMENT=$1

# Set default values based on the environment
if [ "$ENVIRONMENT" == "dev" ]; then
  IMAGE="sfu:dev"
  BASE_NAME="sfu-dev"
  BASE_PORT=3000  # Starting port for dev
elif [ "$ENVIRONMENT" == "prod" ]; then
  IMAGE="sfu:prod"
  BASE_NAME="sfu-prod"
  BASE_PORT=30  # Starting port for prod
else
  echo "Unknown environment: $ENVIRONMENT"
  echo "Usage: $0 {dev|prod}"
  exit 1
fi

NETWORK_NAME="sfu"

# Create the network if it doesn't exist
if [ -z "$(docker network ls -q --filter name=$NETWORK_NAME)" ]; then
  docker network create $NETWORK_NAME
fi

# Set the container name and port
CONTAINER_NAME="${BASE_NAME}"
HOST_PORT=$BASE_PORT  # Use the base port directly

# Stop and remove existing container if it exists
docker rm -f $CONTAINER_NAME 2>/dev/null

# Run the Docker container with appropriate settings
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p $HOST_PORT:$BASE_PORT \
  --add-host host.docker.internal:host-gateway \
  --network $NETWORK_NAME \
  $IMAGE

echo "$CONTAINER_NAME is deployed and running on port $HOST_PORT."