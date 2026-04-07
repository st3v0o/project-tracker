#!/usr/bin/env bash
# Generate a dated Excel backup of all tickets.
# Run from the project root: bash backups/backup.sh
# Override the API base with: API_URL=http://localhost:8080 bash backups/backup.sh
set -e
API_URL="${API_URL:-http://localhost:8080}"
DATE=$(date +%Y-%m-%d)
FILE="backups/tickets-backup-${DATE}.xlsx"
curl -sf -o "$FILE" "${API_URL}/api/tickets/export"
echo "Backup saved to $FILE"
ls -lh "$FILE"
