@echo off
title Java Backend (Logs em logs\java-session-1.log)
cd /d %~dp0

echo Iniciando Java Spring Boot...
echo Os logs desta sessao estao a ser guardados em logs\java-session-1.log
echo.

REM O PowerShell e usado aqui para 'Tee-Object' (clonar o output para o console E para o ficheiro)
powershell -Command ".\mvnw.cmd spring-boot:run 2>&1 | Tee-Object -FilePath logs\java-session-1.log"

echo.
echo O servidor Java foi parado.
pause