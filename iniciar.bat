@echo off
title GM Dashboard - Servidores
echo Iniciando GM Dashboard (Backend + Ngrok)...
echo.
echo Pressione Ctrl+C nesta janela a qualquer momento para parar TUDO.
echo.

REM Executa o script Node.js que faz todo o trabalho
node start.js

REM O script start.js já gerencia o encerramento dos processos filhos