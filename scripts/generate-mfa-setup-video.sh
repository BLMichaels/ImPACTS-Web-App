#!/usr/bin/env bash
# Regenerate homepage MFA how-to video (requires ffmpeg + scripts/.venv-mfa-video).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/scripts/.venv-mfa-video"
if [[ ! -x "$VENV/bin/python" ]]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q pillow
fi
exec "$VENV/bin/python" "$ROOT/scripts/generate_mfa_setup_video.py"
