#!/bin/bash

# Interactive Deployment Menu for PayMe
# Provides options for different deployment scenarios

set -e

WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        PayMe Deployment Manager        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

PS3=$'\n'"${YELLOW}Choose deployment option: ${NC}"
options=(
    "Build Locally & Deploy to Raspberry Pi (Recommended)"
    "Build Locally Only (No Deployment)"
    "Download Pre-built Image & Deploy to RPi"
    "Start Local Development (docker compose up)"
    "Exit"
)

select opt in "${options[@]}"
do
    case $opt in
        "Build Locally & Deploy to Raspberry Pi (Recommended)")
            echo -e "${BLUE}Building PayMe...${NC}"
            ./build-local.sh
            
            echo ""
            read -p "Enter RPi hostname or IP (default: raspberrypi.local): " RPi_HOST
            RPi_HOST="${RPi_HOST:-raspberrypi.local}"
            
            read -p "Enter RPi username (default: pi): " RPi_USER
            RPi_USER="${RPi_USER:-pi}"
            
            echo -e "${BLUE}Deploying to $RPi_USER@$RPi_HOST...${NC}"
            ./deploy.sh "$RPi_HOST" "$RPi_USER"
            break
            ;;
            
        "Build Locally Only (No Deployment)")
            echo -e "${BLUE}Building PayMe locally...${NC}"
            ./build-local.sh
            echo ""
            echo -e "${GREEN}✅ Build complete!${NC}"
            echo "Next: Run './deploy.sh' when ready, or use 'docker compose up -d' locally"
            break
            ;;
            
        "Download Pre-built Image & Deploy to RPi")
            echo -e "${BLUE}Downloading latest pre-built image...${NC}"
            read -p "Enter image tag (default: latest): " IMAGE_TAG
            IMAGE_TAG="${IMAGE_TAG:-latest}"
            
            read -p "Enter RPi hostname or IP (default: raspberrypi.local): " RPi_HOST
            RPi_HOST="${RPi_HOST:-raspberrypi.local}"
            
            read -p "Enter RPi username (default: pi): " RPi_USER
            RPi_USER="${RPi_USER:-pi}"
            
            ./deploy-prebuilt.sh "$IMAGE_TAG" "$RPi_HOST" "$RPi_USER"
            break
            ;;
            
        "Start Local Development (docker compose up)")
            echo -e "${BLUE}Starting PayMe locally...${NC}"
            cd "$WORKDIR"
            docker compose up -d
            echo ""
            echo -e "${GREEN}✅ PayMe is running!${NC}"
            echo "Frontend: http://localhost:3000"
            echo "Backend: http://localhost:3001"
            echo "API Docs: http://localhost:3001/swagger-ui/"
            break
            ;;
            
        "Exit")
            echo "Goodbye!"
            exit 0
            ;;
            
        *) 
            echo "Invalid option $REPLY"
            ;;
    esac
done
