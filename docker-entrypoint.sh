#!/bin/sh
# Self-healing permissions for the uploads volume.
#
# /app/public/uploads is a bind-mounted host directory (see docker-compose.yml).
# A bind mount shadows the image's ownership with the host directory's, so the
# unprivileged `nextjs` user often can't create files there. This entrypoint
# runs as root, fixes ownership, then drops privileges to run the real command.
set -e

UPLOAD_DIR=/app/public/uploads
mkdir -p "$UPLOAD_DIR/recipes"
chown -R nextjs:nodejs "$UPLOAD_DIR"

# Drop root and exec the container command (Dockerfile CMD or compose `command:`).
exec su-exec nextjs:nodejs "$@"
