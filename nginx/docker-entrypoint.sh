#!/bin/sh
# Nginx entrypoint: auto-obtains Let's Encrypt cert or creates a temporary self-signed one.

DOMAIN="h4lw4.ru"
EMAIL="admin@h4lw4.ru"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

# --- Generate .htpasswd from environment variables ---
if [ -n "$MONITOR_USER" ] && [ -n "$MONITOR_PASSWORD" ]; then
    HASH=$(printf '%s' "$MONITOR_PASSWORD" | openssl dgst -sha1 -binary | openssl base64)
    echo "${MONITOR_USER}:{SHA}${HASH}" > /etc/nginx/.htpasswd
    echo "==> .htpasswd generated for user: $MONITOR_USER"
else
    echo "==> WARNING: MONITOR_USER / MONITOR_PASSWORD not set, /monitor will be unprotected"
fi

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
