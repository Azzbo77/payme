#!/bin/bash

# Deploy pre-built Docker image from registry
# Usage: ./deploy-prebuilt.sh [image-tag] [rpi-host] [rpi-user]
# Example: ./deploy-prebuilt.sh latest 192.168.1.100 pi

set -e

IMAGE_TAG="${1:-latest}"
RPi_HOST="${2:-raspberrypi.local}"
RPi_USER="${3:-pi}"
REGISTRY="ghcr.io/azzbo77/payme"  # Change this to your registry
FULL_IMAGE="$REGISTRY:$IMAGE_TAG"

echo "🚀 Deploying pre-built image: $FULL_IMAGE"
echo "📍 Target: $RPi_USER@$RPi_HOST"
echo ""

# Ask for confirmation
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo "📦 Pulling image on RPi..."
ssh "$RPi_User@$RPi_HOST" << EOF
  echo "Pulling $FULL_IMAGE..."
  docker pull "$FULL_IMAGE"
  
  # Tag it locally for docker compose to find it
  docker tag "$FULL_IMAGE" payme:latest
  
  cd ~/payme || cd /opt/payme
  echo "Starting services..."
  docker compose -f docker-compose.rpi.yml up -d
  
  echo "✅ PayMe is running!"
  docker compose logs -f payme
EOF

echo "✨ Deployment complete!"
