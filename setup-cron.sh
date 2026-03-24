#!/bin/bash
# =============================================================================
# Daily Outreach Automation Setup
# =============================================================================
#
# This script sets up a daily cron job that:
# 1. Finds ~30 new guest post prospect sites
# 2. Sends up to 20 outreach emails (configurable per project)
#
# Run this ONCE on your VPS after deploying.
#
# Prerequisites:
# 1. Add a "cronSecret" to your data/config.json:
#    { ..., "cronSecret": "your-random-secret-here" }
#
# 2. Run this script:
#    chmod +x setup-cron.sh && ./setup-cron.sh
#
# =============================================================================

DOMAIN="https://shoumya.me"
CRON_SECRET=""

# Prompt for secret if not set
if [ -z "$CRON_SECRET" ]; then
  echo ""
  echo "================================================"
  echo "  Daily Outreach Cron Setup"
  echo "================================================"
  echo ""
  echo "First, add a 'cronSecret' to your data/config.json."
  echo "Example:"
  echo '  { ..., "cronSecret": "my-super-secret-key-123" }'
  echo ""
  read -p "Enter your cron secret: " CRON_SECRET
  echo ""
fi

if [ -z "$CRON_SECRET" ]; then
  echo "Error: No secret provided. Exiting."
  exit 1
fi

# Create the cron command — runs daily at 9:00 AM server time
CRON_CMD="0 9 * * * curl -s -X POST '${DOMAIN}/api/tools/guest-post-outreach/daily-run?secret=${CRON_SECRET}' -H 'Content-Type: application/json' >> /var/log/outreach-cron.log 2>&1"

# Check if cron already exists
if crontab -l 2>/dev/null | grep -q "daily-run"; then
  echo "Cron job already exists. Updating..."
  crontab -l 2>/dev/null | grep -v "daily-run" | crontab -
fi

# Add the cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo "Cron job installed successfully!"
echo ""
echo "Schedule: Every day at 9:00 AM"
echo "Endpoint: ${DOMAIN}/api/tools/guest-post-outreach/daily-run"
echo "Log file: /var/log/outreach-cron.log"
echo ""
echo "To verify: crontab -l"
echo "To test now: curl -s -X POST '${DOMAIN}/api/tools/guest-post-outreach/daily-run?secret=${CRON_SECRET}' -H 'Content-Type: application/json'"
echo ""
echo "The daily run will:"
echo "  1. Find ~30 new prospect sites"
echo "  2. Send up to 20 emails (configurable per project)"
echo "  3. Log results to /var/log/outreach-cron.log"
