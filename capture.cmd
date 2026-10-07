@echo off
rem PowerShell swallows the "--" of "npm run capture -- --flag", so the flags never reach the CLI.
rem This wrapper takes them directly:  .\capture --flow dang-ky-shop-mock --no-figma
node "%~dp0node_modules\tsx\dist\cli.mjs" "%~dp0capture\cli.ts" %*
