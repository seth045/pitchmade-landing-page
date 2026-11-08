@echo off
cd /d "%~dp0"
echo Starting Pitchmade's local landing page...
node scripts/build.mjs
if errorlevel 1 goto error
node scripts/start.mjs
if errorlevel 1 goto error
goto end
:error
echo.
echo Pitchmade could not start. Please copy the error above into the project chat.
pause
:end
