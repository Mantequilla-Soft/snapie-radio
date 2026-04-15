#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_NAME="snapie-radio"
LOCAL_BIN="$HOME/.local/bin"

echo "==> snapie-radio installer"
echo ""

# ── Node.js ──────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Install it via nvm (https://github.com/nvm-sh/nvm) or your system package manager, then re-run this script."
  exit 1
fi
NODE_VER=$(node -e "process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)" 2>/dev/null && echo ok || echo old)
if [ "$NODE_VER" = "old" ]; then
  echo "ERROR: Node.js 18+ is required. Current: $(node -v)"
  exit 1
fi
echo "[✓] Node.js $(node -v)"

# ── ffmpeg ────────────────────────────────────────────────────────────────────
if ! command -v ffmpeg &>/dev/null; then
  echo "[…] Installing ffmpeg..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y ffmpeg
  elif command -v brew &>/dev/null; then
    brew install ffmpeg
  else
    echo "ERROR: Cannot install ffmpeg automatically. Please install it manually and re-run."
    exit 1
  fi
fi
echo "[✓] ffmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"

# ── yt-dlp ────────────────────────────────────────────────────────────────────
if ! command -v yt-dlp &>/dev/null; then
  echo "[…] Installing yt-dlp..."
  pip3 install yt-dlp
else
  echo "[…] Updating yt-dlp to latest..."
  pip3 install --upgrade yt-dlp --quiet
fi
echo "[✓] yt-dlp $(yt-dlp --version)"

# ── npm dependencies ──────────────────────────────────────────────────────────
echo "[…] Installing npm dependencies..."
cd "$REPO_DIR"
npm install --quiet

# ── Build TypeScript ──────────────────────────────────────────────────────────
echo "[…] Building..."
npm run build

# ── .env setup ───────────────────────────────────────────────────────────────
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo ""
  echo "[!] Created .env from .env.example — fill in your LiveKit credentials:"
  echo "    $REPO_DIR/.env"
  echo ""
fi

# ── Shell command ─────────────────────────────────────────────────────────────
mkdir -p "$LOCAL_BIN"

cat > "$LOCAL_BIN/$BIN_NAME" <<EOF
#!/usr/bin/env bash
cd "$REPO_DIR" && node dist/cli.js "\$@"
EOF
chmod +x "$LOCAL_BIN/$BIN_NAME"

# Add ~/.local/bin to PATH if it isn't already
SHELL_RC=""
if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "$(which zsh 2>/dev/null)" ]; then
  SHELL_RC="$HOME/.zshrc"
else
  SHELL_RC="$HOME/.bashrc"
fi

if ! grep -q "$LOCAL_BIN" "$SHELL_RC" 2>/dev/null; then
  echo "" >> "$SHELL_RC"
  echo "# snapie-radio" >> "$SHELL_RC"
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
  echo "[✓] Added ~/.local/bin to PATH in $SHELL_RC"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " snapie-radio installed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Reload your shell, then run:"
echo ""
echo "  snapie-radio start <room-name> <youtube-playlist-url>"
echo ""
echo "Example:"
echo "  snapie-radio start my-room 'https://www.youtube.com/playlist?list=PL...'"
echo ""
