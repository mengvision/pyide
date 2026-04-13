#!/bin/bash
# PyIDE LAN Deployment Quick Start Script
# Run this on your Linux server to deploy PyIDE quickly

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     PyIDE LAN Deployment Script          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker first:"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sudo sh get-docker.sh"
    exit 1
fi

echo -e "${GREEN}✓ Docker found: $(docker --version)${NC}"

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose plugin"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose found${NC}"
echo ""

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    echo -e "${YELLOW}⚠ Could not auto-detect server IP${NC}"
    read -p "Enter your server IP address: " SERVER_IP
fi

echo -e "${GREEN}✓ Server IP: $SERVER_IP${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "Creating .env from template..."
    cp .env.lan.example .env
    
    # Generate secure secret key
    if command -v openssl &> /dev/null; then
        SECRET_KEY=$(openssl rand -hex 32)
        sed -i "s/SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" .env
        echo -e "${GREEN}✓ Generated secure SECRET_KEY${NC}"
    fi
    
    # Generate secure database password
    if command -v openssl &> /dev/null; then
        DB_PASSWORD=$(openssl rand -hex 16)
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$DB_PASSWORD/" .env
        echo -e "${GREEN}✓ Generated secure database password${NC}"
    fi
    
    echo -e "${YELLOW}Please review and edit .env file if needed${NC}"
    echo ""
fi

# Build and start services
echo -e "${GREEN}Starting PyIDE services...${NC}"
docker compose -f docker-compose.lan.yml up -d --build

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Deployment Complete!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Access URLs:${NC}"
echo -e "  Web IDE:    ${YELLOW}http://$SERVER_IP:3000${NC}"
echo -e "  API:        ${YELLOW}http://$SERVER_IP:8000${NC}"
echo -e "  API Docs:   ${YELLOW}http://$SERVER_IP:8000/docs${NC}"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo "  1. Open http://$SERVER_IP:3000 in your browser"
echo "  2. Register a new account"
echo "  3. Start coding!"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo "  docker compose -f docker-compose.lan.yml logs -f"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo "  docker compose -f docker-compose.lan.yml down"
echo ""
