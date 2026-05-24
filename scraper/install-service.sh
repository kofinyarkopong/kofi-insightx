#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Install job-watcher.js as a macOS launchd user agent
# It will start automatically on login and restart if it crashes.
#
# Usage: bash install-service.sh
# Remove: bash install-service.sh --uninstall
# ─────────────────────────────────────────────────────────────────────────────

LABEL="com.kofiinsightx.jobwatcher"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
SCRAPER_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_PATH="$(which node)"
LOG_DIR="$HOME/Library/Logs/KofiInsightX"

if [ "$1" = "--uninstall" ]; then
  echo "Uninstalling job-watcher service…"
  launchctl unload "$PLIST" 2>/dev/null
  rm -f "$PLIST"
  echo "Done. The watcher will no longer start automatically."
  exit 0
fi

mkdir -p "$LOG_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${SCRAPER_DIR}/src/job-watcher.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${SCRAPER_DIR}</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/job-watcher.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/job-watcher-error.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST"

echo ""
echo "✓ Job watcher installed as launchd service: ${LABEL}"
echo "  Logs : ${LOG_DIR}/job-watcher.log"
echo "  Stop : launchctl unload ${PLIST}"
echo "  Start: launchctl load ${PLIST}"
echo ""
