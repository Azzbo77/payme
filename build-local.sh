#!/bin/bash

# Local development build script
# Run this on your powerful computer before deploying to RPi
# Usage: ./build-local.sh

set -e

WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🏗️  Building PayMe (development)..."
cd "$WORKDIR"

# Build backend
echo "📦 Building Rust backend..."
cd backend
cargo build --release
cd ..

# Build frontend
echo "📦 Building React frontend..."
cd frontend
npm ci
npm run build
cd ..

echo "✨ Build complete! Ready to deploy."
echo ""
echo "Next steps:"
echo "  1. Run: ./deploy.sh <rpi-ip> <rpi-user>"
echo "  2. Or: docker compose up -d (for local testing)"
