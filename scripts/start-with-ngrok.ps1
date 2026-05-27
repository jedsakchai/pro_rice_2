param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 3002 })
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodeExe = 'C:\Program Files\nodejs\node.exe'
$ngrokConfig = Join-Path $root 'ngrok.yml'

if (-not (Test-Path $nodeExe)) {
  throw "Node.js not found at $nodeExe"
}

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
  throw 'ngrok CLI is not installed or not on PATH. Install ngrok before running this launcher.'
}

if (Test-Path $ngrokConfig) {
  Write-Host "Using ngrok config: $ngrokConfig"
}

if ($env:NGROK_AUTHTOKEN) {
  Write-Host 'Registering ngrok authtoken from NGROK_AUTHTOKEN...'
  & ngrok config add-authtoken $env:NGROK_AUTHTOKEN | Out-Null
}

Write-Host "Starting app on port $Port..."
Start-Process -FilePath $nodeExe -ArgumentList 'app.js' -WorkingDirectory $root | Out-Null

Write-Host "Starting ngrok tunnel to http://localhost:$Port ..."
Start-Process -FilePath 'ngrok' -ArgumentList @('start', 'rice-mill', '--config', $ngrokConfig) -WorkingDirectory $root | Out-Null
Write-Host "ngrok launched. Open http://127.0.0.1:4040 to inspect the tunnel."

$publicUrl = $null
for ($i = 0; $i -lt 40; $i++) {
  try {
    $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -Method Get -TimeoutSec 2
    $publicUrl = $tunnels.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1 -ExpandProperty public_url
    if (-not $publicUrl) {
      $publicUrl = $tunnels.tunnels | Select-Object -First 1 -ExpandProperty public_url
    }
    if ($publicUrl) { break }
  } catch {
    # keep trying until ngrok API becomes available
  }
}

if ($publicUrl) {
  try {
    Set-Clipboard -Value $publicUrl
    Write-Host "Public URL copied to clipboard: $publicUrl"
  } catch {
    Write-Host "Public URL: $publicUrl"
  }
  Start-Process $publicUrl | Out-Null
} else {
  Write-Host 'ngrok is still starting. Open http://127.0.0.1:4040 after a moment to copy the public URL.'
}