#!/bin/sh
# Nginx entrypoint: auto-obtains Let's Encrypt cert or creates a temporary self-signed one.

DOMAIN="h4lw4.ru"
EMAIL="admin@h4lw4.ru"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
CERT_RELOAD_INTERVAL_SECONDS="${CERT_RELOAD_INTERVAL_SECONDS:-300}"

get_cert_mtime() {
    if [ -f "$CERT_PATH/fullchain.pem" ]; then
        stat -c %Y "$CERT_PATH/fullchain.pem" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

watch_certificate_changes() {
    last_mtime="$(get_cert_mtime)"

    while true; do
        sleep "$CERT_RELOAD_INTERVAL_SECONDS"
        current_mtime="$(get_cert_mtime)"

        if [ -n "$last_mtime" ] && [ -n "$current_mtime" ] && [ "$current_mtime" != "$last_mtime" ]; then
            echo "==> SSL certificate changed. Reloading nginx..."
            nginx -s reload || echo "==> Failed to reload nginx after certificate change."
        fi

        last_mtime="$current_mtime"
    done
}



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

watch_certificate_changes &
exec nginx -g "daemon off;"
