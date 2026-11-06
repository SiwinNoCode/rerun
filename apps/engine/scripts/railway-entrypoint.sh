#!/bin/sh
set -eu

# Railway mounts persistent volumes as root. Fix the mount before dropping privileges.
if [ "$(id -u)" = "0" ]; then
    mkdir -p /data
    chown -R rerun:rerun /data
    exec gosu rerun "$@"
fi

exec "$@"
