@echo off
title GM Dashboard Server (Java + Ngrok)

REM Muda o diretorio para a pasta onde este .bat esta localizado.
cd /d %~dp0

echo Iniciando o GM Dashboard (Backend Java + Ngrok)...
echo.

REM Roda o script de automacao (start.js) atraves do npm
npm start

REM O script so chegara aqui quando voce fechar o 'npm start' (com Ctrl+C)
echo.
echo Servidores finalizados.
pause