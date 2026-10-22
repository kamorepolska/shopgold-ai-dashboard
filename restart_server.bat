@echo off
echo Zatrzymuję serwer Node.js...
taskkill /F /IM node.exe /T 2>nul
timeout /t 1 /nobreak >nul
echo Uruchamiam serwer ShopGold...
cd /d "%~dp0"
start /B node backend/server.js
timeout /t 2 /nobreak >nul
echo Serwer uruchomiony na http://localhost:3000
echo.
echo Nacisnij dowolny klawisz aby zamknac...
pause >nul
