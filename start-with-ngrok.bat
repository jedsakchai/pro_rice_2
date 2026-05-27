@echo off
setlocal

cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" scripts\start-with-ngrok.js
