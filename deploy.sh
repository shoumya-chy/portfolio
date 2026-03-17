#!/bin/bash
# Deployment script for DigitalOcean Droplet
# Run this on your Droplet after initial server setup

set -e

APP_DIR="/var/www/shoumya-portfolio"
REPO="https://github.com/shoumya-chy/portfolio.git"

echo "==> Pulling latest code..."
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin main
else
    git clone "$REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

echo "==> Installing dependencies..."
npm ci --production=false

echo "==> Building project..."
npm run build

echo "==> Restarting app with PM2..."
pm2 startOrRestart ecosystem.config.js
pm2 save

echo "==> Done! App is running on port 3000"
