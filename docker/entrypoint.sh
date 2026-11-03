#!/bin/sh
set -eu
if [ -z "${STAFF_PASSWORD:-}" ] || [ -z "${STAFF_SECRET:-}" ]; then
  echo "Cần STAFF_PASSWORD và STAFF_SECRET." >&2
  exit 1
fi
nl='
'
case "$STAFF_PASSWORD$STAFF_SECRET" in
  *"$nl"*)
    echo "Mật khẩu và chuỗi bí mật phải nằm trên một dòng." >&2
    exit 1
    ;;
esac
escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}
umask 077
printf 'STAFF_PASSWORD="%s"\nSTAFF_SECRET="%s"\n' "$(escape "$STAFF_PASSWORD")" "$(escape "$STAFF_SECRET")" > /app/.dev.vars
export CI=1
export WRANGLER_SEND_METRICS=false
exec npx wrangler dev --local --ip 0.0.0.0 --port 8787 --persist-to /data --show-interactive-dev-session=false
