#!/bin/bash

# Build and Deploy PayMe to Raspberry Pi
# Usage: ./deploy.sh [rpi-host] [rpi-user]
# Example: ./deploy.sh 192.168.1.100 pi

set -e

RPi_HOST="${1:-raspberrypi.local}"
RPi_USER="${2:-pi}"
IMAGE_NAME="payme:latest"
TAR_FILE="payme-image.tar.gz"
WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🏗️  Building PayMe Docker image..."
docker build -t "$IMAGE_NAME" "$WORKDIR"

echo "📦 Saving image to tar.gz..."
docker save "$IMAGE_NAME" | gzip > "$TAR_FILE"
SIZE=$(du -h "$TAR_FILE" | cut -f1)
echo "✅ Image saved: $SIZE"

echo "🚀 Transferring to RPi ($RPi_HOST)..."
scp "$TAR_FILE" "$RPi_USER@$RPi_HOST:/tmp/"

echo "⚙️  Loading image on RPi and starting services..."
ssh "$RPi_USER@$RPi_HOST" << 'EOF'
  echo "Loading Docker image..."
  docker load < /tmp/payme-image.tar.gz
  rm /tmp/payme-image.tar.gz
  
  cd ~/payme || cd /opt/payme
  echo "Starting services..."
  docker compose up -d
  
  echo "✅ PayMe is running!"
  docker compose logs -f payme
EOF

echo "✨ Deployment complete!"
rm "$TAR_FILE"
