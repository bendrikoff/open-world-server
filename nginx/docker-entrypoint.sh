#!/bin/sh
# Nginx entrypoint: auto-obtains Let's Encrypt cert or creates a temporary self-signed one.

DOMAIN="h4lw4.ru"
EMAIL="admin@h4lw4.ru"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

if [ ! -f "$CERT_PATH/fullchain.pem" ]; then
    echo "==> No SSL certificate found. Installing certbot & openssl..."
    apk add --no-cache openssl certbot

    echo "==> Attempting to obtain Let's Encrypt certificate..."
    certbot certonly --standalone \
        --email "$EMAIL" \
        --agree-tos --no-eff-email \
        --preferred-challenges http \
        -d "$DOMAIN" \
        --non-interactive 2>&1

    if [ $? -ne 0 ] || [ ! -f "$CERT_PATH/fullchain.pem" ]; then
        echo "==> Let's Encrypt failed. Generating temporary self-signed cert..."
        mkdir -p "$CERT_PATH"
        openssl req -x509 -nodes -days 7 \
            -newkey rsa:2048 \
            -keyout "$CERT_PATH/privkey.pem" \
            -out "$CERT_PATH/fullchain.pem" \
            -subj "/CN=$DOMAIN"
        echo "==> Temporary self-signed certificate created."
    else
        echo "==> Let's Encrypt certificate obtained successfully!"
    fi
fi

exec nginx -g "daemon off;"
