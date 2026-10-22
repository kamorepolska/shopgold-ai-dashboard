@echo off
cd /d "%~dp0"
echo Naprawiam sourcing.js...
node emergency_repair.js
if %errorlevel% equ 0 (
  echo.
  echo Zatrzymuje stary serwer...
  taskkill /F /IM node.exe 2>nul
  timeout /t 1 /nobreak >nul
  echo Uruchamiam serwer...
  start "ShopGold Server" cmd /k "node backend/server.js"
  echo.
  echo Gotowe! Otworz przegladarke na http://localhost:3000
  echo Nacisnij Ctrl+Shift+R w przegladarce aby odswiezsc cache
) else (
  echo.
  echo Blad naprawy! Sprawdz powyzszy komunikat.
)
pause
