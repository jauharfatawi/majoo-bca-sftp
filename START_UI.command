#!/bin/bash
# Double-click dari Finder untuk menjalankan UI. Setara dengan START_UI.bat di Windows.
# Kalau Finder menolak menjalankannya, sekali saja di Terminal:  chmod +x START_UI.command

cd "$(dirname "$0")" || exit 1

# Finder tidak membaca ~/.zshrc, jadi node dari Homebrew/nvm belum tentu ada di PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

if ! command -v node >/dev/null 2>&1; then
    echo
    echo "  Node.js tidak ditemukan. Install dulu dari https://nodejs.org"
    echo
    read -n 1 -s -r -p "  Tekan tombol apa saja untuk menutup..."
    exit 1
fi

echo "Menjalankan server... jangan tutup jendela ini selama proses berjalan."
node server.js

read -n 1 -s -r -p "Server berhenti. Tekan tombol apa saja untuk menutup..."
