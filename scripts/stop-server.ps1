param()

$ErrorActionPreference = 'SilentlyContinue'

Get-Process node, ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host 'Stopped Node.js and ngrok processes.'
