@echo off
rem One-time setup after cloning: dependencies, the browser Playwright drives, the Figma plugin build,
rem then a check of what is ready.  Run:  .\setup
cd /d "%~dp0"
call npm install || exit /b 1
call npx playwright install chromium || exit /b 1
call npm run build:plugin || exit /b 1
echo.
call "%~dp0capture.cmd" --doctor
exit /b 0
