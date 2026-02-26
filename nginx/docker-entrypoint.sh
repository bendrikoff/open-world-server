#!/bin/sh
# Nginx entrypoint: ensures a certificate exists before starting.
# If Let's Encrypt cert is missing, creates a temporary self-signed one.

DOMAIN="h4lw4.ru"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

if [ ! -f "$CERT_PATH/fullchain.pem" ]; then
    echo "==> No SSL certificate found. Installing openssl..."
    apk add --no-cache openssl
    echo "==> Generating temporary self-signed cert..."
    mkdir -p "$CERT_PATH"
    openssl req -x509 -nodes -days 7 \
        -newkey rsa:2048 \
        -keyout "$CERT_PATH/privkey.pem" \
        -out "$CERT_PATH/fullchain.pem" \
        -subj "/CN=$DOMAIN"
    echo "==> Temporary certificate created. Run init-letsencrypt.sh to get a real one."
fi

exec nginx -g "daemon off;"
