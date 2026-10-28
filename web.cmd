@echo off
rem The local page for browsing the captured flows and sending them to Figma:  .\web
rem Opens http://127.0.0.1:4646 in the browser; Ctrl+C stops it.
node "%~dp0node_modules\tsx\dist\cli.mjs" "%~dp0web\server.ts" --open %*
