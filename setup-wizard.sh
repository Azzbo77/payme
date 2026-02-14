#!/bin/bash

# PayMe First-Time Setup Wizard
# Helps set up SSH and deployment for Raspberry Pi

set -e

clear
echo "╔════════════════════════════════════════╗"
echo "║   PayMe Raspberry Pi Setup Wizard      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker found"
echo ""

# Get RPi details
read -p "📍 Enter Raspberry Pi hostname or IP (e.g., 192.168.1.100): " RPi_HOST
read -p "👤 Enter Raspberry Pi username (default: pi): " RPi_USER
RPi_USER="${RPi_USER:-pi}"

echo ""
echo "🔐 Setting up SSH passwordless access..."
echo ""

# Test SSH connection
if ssh -o ConnectTimeout=5 "$RPi_USER@$RPi_HOST" "echo OK" &>/dev/null; then
    echo "✅ SSH connection successful"
    
    # Check if key already exists
    if ssh "$RPi_USER@$RPi_HOST" "ls ~/.ssh/authorized_keys" &>/dev/null; then
        echo "✅ SSH key already configured"
    else
        echo "Setting up SSH key..."
        ssh-copy-id "$RPi_USER@$RPi_HOST"
    fi
else
    echo "⚠️  Could not connect to RPi"
    echo "Make sure:"
    echo "  1. RPi is powered on and connected to network"
    echo "  2. Hostname/IP is correct: $RPi_HOST"
    echo "  3. Username is correct: $RPi_USER"
    echo ""
    echo "Try: ping $RPi_HOST"
    exit 1
fi

echo ""
echo "📦 Checking Docker on RPi..."

if ssh "$RPi_USER@$RPi_HOST" "docker --version" &>/dev/null; then
    echo "✅ Docker is installed on RPi"
else
    echo "⚠️  Docker not found on RPi"
    read -p "Install Docker on RPi? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ssh "$RPi_User@$RPi_HOST" << 'EOF'
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER
newgrp docker
EOF
        echo "✅ Docker installed"
    fi
fi

echo ""
echo "💾 Saving configuration..."

# Save config for future use
mkdir -p ~/.payme
cat > ~/.payme/config << EOF
RPi_HOST="$RPi_HOST"
RPi_USER="$RPi_USER"
EOF

echo ""
echo "✨ Setup complete!"
echo ""
echo "You can now use:"
echo ""
echo "  ./deploy-menu.sh          # Interactive deployment menu"
echo "  ./deploy.sh               # Uses saved config (no args needed)"
echo "  ./build-local.sh          # Build on this machine"
echo ""
echo "Configuration saved to: ~/.payme/config"
echo ""
read -p "Ready to build and deploy? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    source ~/.payme/config
    ./build-local.sh
    ./deploy.sh "$RPi_HOST" "$RPi_User"
fi
