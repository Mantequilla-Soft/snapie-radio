#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_NAME="snapie-radio"
LOCAL_BIN="$HOME/.local/bin"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Snapie Radio — installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Node.js ───────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Install it via nvm (https://github.com/nvm-sh/nvm) or your package manager, then re-run."
  exit 1
fi
node -e "if(parseInt(process.versions.node)<18){process.stderr.write('ERROR: Node.js 18+ required. Got: '+process.version+'\n');process.exit(1)}"
echo "[✓] Node.js $(node -v)"

# ── ffmpeg ────────────────────────────────────────────────────────────────────
if ! command -v ffmpeg &>/dev/null; then
  echo "[…] Installing ffmpeg..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y ffmpeg
  elif command -v brew &>/dev/null; then
    brew install ffmpeg
  else
    echo "ERROR: Cannot install ffmpeg automatically. Install it manually and re-run."
    exit 1
  fi
fi
echo "[✓] ffmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"

# ── yt-dlp (standalone binary — avoids pip/externally-managed-environment) ───
if ! command -v yt-dlp &>/dev/null; then
  echo "[…] Installing yt-dlp..."
  mkdir -p "$LOCAL_BIN"
  curl -sL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o "$LOCAL_BIN/yt-dlp"
  chmod +x "$LOCAL_BIN/yt-dlp"
  export PATH="$LOCAL_BIN:$PATH"
else
  echo "[…] Updating yt-dlp..."
  yt-dlp -U --quiet 2>/dev/null || true
fi
echo "[✓] yt-dlp $(yt-dlp --version)"

# ── npm dependencies ──────────────────────────────────────────────────────────
echo "[…] Installing npm dependencies..."
cd "$REPO_DIR"
npm install --quiet

# ── Build TypeScript ──────────────────────────────────────────────────────────
echo "[…] Building..."
npm run build

# ── .env setup ────────────────────────────────────────────────────────────────
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo ""
  echo "[!] Created .env from .env.example"
  echo "    Check the values in: $REPO_DIR/.env"
  echo ""
fi

# ── Shell command (opens the DJ console) ──────────────────────────────────────
mkdir -p "$LOCAL_BIN"

cat > "$LOCAL_BIN/$BIN_NAME" <<EOF
#!/usr/bin/env bash
cd "$REPO_DIR" && node dist/server.js
EOF
chmod +x "$LOCAL_BIN/$BIN_NAME"

# Add ~/.local/bin to PATH if needed
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
echo " Snapie Radio installed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Start the DJ console:"
echo ""
echo "  snapie-radio"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo "(Hive Keychain extension required)"
echo ""
