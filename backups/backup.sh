#!/usr/bin/env bash
# Run from project root: bash backups/backup.sh
set -e
DATE=$(date +%Y-%m-%d)
FILE="backups/tickets-backup-${DATE}.xlsx"
curl -sf -o "$FILE" "http://localhost:8080/api/tickets/export"
echo "Backup saved to $FILE"
ls -lh "$FILE"
