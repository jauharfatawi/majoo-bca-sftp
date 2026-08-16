@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1 || (
  echo.
  echo   Node.js tidak ditemukan. Install dulu dari https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo Menjalankan server... jangan tutup jendela ini selama proses berjalan.
node server.js
pause
