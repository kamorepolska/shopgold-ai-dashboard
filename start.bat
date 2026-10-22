@echo off
echo ============================================
echo  ShopGold AI Dashboard — Uruchamianie
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Instalowanie zaleznosci npm...
npm install
if %ERRORLEVEL% neq 0 (
  echo BLAD: npm install nieudany. Upewnij sie ze Node.js jest zainstalowany.
  pause
  exit /b 1
)

echo.
echo [2/2] Uruchamianie serwera...
echo  Dashboard bedzie dostepny pod: http://localhost:3000
echo  Nacisnij Ctrl+C aby zatrzymac.
echo.
npm start
pause
