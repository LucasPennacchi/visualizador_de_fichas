@echo off
title Ngrok Tunnel (Logs em logs\ngrok-session-1.log)
cd /d %~dp0

echo Iniciando Ngrok na porta 8080...
echo Os logs desta sessao estao a ser guardados em logs\ngrok-session-1.log
echo.

REM O PowerShell clona o output do Ngrok para o console e para o ficheiro de log
powershell -Command "ngrok http 8080 2>&1 | Tee-Object -FilePath logs\ngrok-session-1.log"

echo.
echo O Ngrok foi parado.
pause