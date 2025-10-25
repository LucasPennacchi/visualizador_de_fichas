@echo off
title GM Dashboard Orchestrator
cd /d %~dp0

REM --- 1. ROTAÇÃO DOS LOGS (FIFO) ---
echo Rotacionando logs...
IF NOT EXIST logs ( mkdir logs )

REM Apaga o log mais antigo (sessao 3)
IF EXIST logs\java-session-3.log ( del logs\java-session-3.log )
IF EXIST logs\ngrok-session-3.log ( del logs\ngrok-session-3.log )

REM Move a sessao 2 para 3
IF EXIST logs\java-session-2.log ( ren logs\java-session-2.log java-session-3.log )
IF EXIST logs\ngrok-session-2.log ( ren logs\ngrok-session-2.log ngrok-session-3.log )

REM Move a sessao 1 para 2
IF EXIST logs\java-session-1.log ( ren logs\java-session-1.log java-session-2.log )
IF EXIST logs\ngrok-session-1.log ( ren logs\ngrok-session-1.log ngrok-session-2.log )

echo Logs rotacionados. Os novos logs serao "session-1".

REM --- 2. INICIAR SERVIDORES EM JANELAS SEPARADAS ---
echo Iniciando servidores em novas janelas (com logs)...
START "Java Backend" cmd /c "run-java.bat"
START "Ngrok Tunnel" cmd /c "run-ngrok.bat"

REM --- 3. OBTER O LINK ---
echo.
echo Aguardando 15 segundos para o Ngrok e o Java iniciarem...
REM (O Java demora a compilar, precisamos de esperar)
timeout /t 15 /nobreak > nul

echo Buscando link do Ngrok e copiando para o clipboard...
REM Executa o novo script "get-link" do package.json
npm run get-link

echo.
echo =================================================================
echo O link foi copiado!
echo =================================================================
echo.
echo Pode fechar esta janela (mas mantenha as janelas "Java Backend" e "Ngrok Tunnel" abertas).
echo.
pause