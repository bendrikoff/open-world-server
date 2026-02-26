#!/bin/sh
# ============================================================
# init-letsencrypt.sh
# Run this ONCE on the server to replace the temporary self-signed
# certificate with a real Let's Encrypt certificate.
#
# Prerequisites:
#   - DNS A-record for h4lw4.ru -> 51.250.19.14
#   - docker compose is running (docker compose up -d)
#
# Usage:
#   chmod +x nginx/init-letsencrypt.sh
#   sudo ./nginx/init-letsencrypt.sh
# ============================================================

DOMAIN="h4lw4.ru"
EMAIL="admin@h4lw4.ru"  # Change to your real email

set -e

echo "=== Step 1: Removing temporary self-signed certificate ==="
rm -rf certbot/conf/live/$DOMAIN
rm -rf certbot/conf/archive/$DOMAIN
rm -rf certbot/conf/renewal/$DOMAIN.conf

echo "=== Step 2: Requesting real certificate from Let's Encrypt ==="
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "$DOMAIN"

echo "=== Step 3: Reloading Nginx ==="
docker compose exec nginx nginx -s reload

echo ""
echo "=== Done! Real HTTPS certificate is now active at https://$DOMAIN ==="
echo "Certificate will auto-renew via the certbot container."
