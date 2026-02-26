#!/bin/sh
# ============================================================
# init-letsencrypt.sh
# Run this ONCE on the server to obtain the SSL certificate.
# Make sure port 80 is free and DNS for h4lw4.ru points to this server.
#
# Usage:
#   chmod +x nginx/init-letsencrypt.sh
#   sudo ./nginx/init-letsencrypt.sh
# ============================================================

DOMAIN="h4lw4.ru"
EMAIL="admin@h4lw4.ru"  # Change to your real email

set -e

echo "=== Step 1: Stopping any running containers ==="
docker compose down 2>/dev/null || true

echo "=== Step 2: Obtaining certificate via standalone mode ==="
mkdir -p certbot/conf certbot/www
docker run --rm \
    -p 80:80 \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    certbot/certbot certonly \
    --standalone \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

echo "=== Step 3: Starting all services ==="
docker compose up -d

echo ""
echo "=== Done! HTTPS is now active at https://$DOMAIN ==="
echo "Certificate will auto-renew via the certbot container."
