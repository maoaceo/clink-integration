#!/bin/sh
set -eu
[ "$(id -u)" = 0 ] || { echo 'Use Linux root for apt dependency installation'; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates python3 nodejs npm xvfb xauth libgl1 libx11-xcb1 libx11-6 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libasound2t64 libdbus-1-3 libdrm2 libfontconfig1 libfreetype6 libglib2.0-0t64 libgudev-1.0-0 libopus0 libpixman-1-0 libpulse0 libv4l-0 libxcb-dri3-0 libxcb1 libxslt1.1 libnss3 libnspr4 libxss1 libxcb-xinerama0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1 libxcb-render-util0 libxcb-xkb1 libxkbcommon-x11-0 libxcb-shape0
# Apt verifies packages using signed repository metadata. No vendor postinst executed.
