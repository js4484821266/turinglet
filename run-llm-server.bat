@echo off
setlocal enabledelayedexpansion

echo Starting Sammagou LLM Server with auto-restart...
echo.

:restart
echo.
echo [%date% %time%] Starting LLM server...
call .venv-llm\Scripts\activate.bat
npm run llm:server

echo.
echo [%date% %time%] LLM server crashed or stopped unexpectedly.
echo Waiting 5 seconds before restart...
timeout /t 5 /nobreak
goto restart
