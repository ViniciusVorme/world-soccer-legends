@echo off
cd /d "%~dp0"
echo.
echo  World Soccer Legends
echo  =====================
echo.
echo  Servidor local: http://localhost:8765/
echo  Pressione Ctrl+C para encerrar.
echo.
start "" "http://localhost:8765/"
python -m http.server 8765
