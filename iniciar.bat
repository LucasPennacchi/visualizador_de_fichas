@echo off
title GM Dashboard Server

REM Muda o diretorio para a pasta onde este .bat esta localizado.
REM Isso e crucial para o 'npm start' encontrar o 'package.json'.
cd /d %~dp0

echo Iniciando o GM Dashboard (Backend + Ngrok)...
echo.

REM Roda o script de automacao
npm start

REM O script so chegara aqui quando voce fechar o 'npm start' (com Ctrl+C)
echo.
echo Servidores finalizados.
pause