param()
try {
  $root = Split-Path -Parent $PSScriptRoot
  Write-Host "Working in $root"

  Write-Host "Fetching ngrok download page..."
  $page = Invoke-WebRequest -UseBasicParsing 'https://ngrok.com/download'
  $html = $page.Content

  $pattern = 'https://[^\s]+windows-amd64[^\s]+zip'
  $matches = [regex]::Matches($html, $pattern)
  $url = $null
  foreach ($m in $matches) {
    if ($m.Value -match 'v3') { $url = $m.Value; break }
  }
  if (-not $url -and $matches.Count -gt 0) { $url = $matches[0].Value }

  if (-not $url) {
    Write-Error "No download URL found on ngrok download page"
    exit 2
  }

  Write-Host "Download URL: $url"
  $zip = Join-Path $env:TEMP 'ngrok_v3_download.zip'
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Write-Host "Downloading to $zip ..."
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 120

  $dest = Join-Path $env:TEMP 'ngrok_v3_unzip'
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $dest -Force
  $exe = Get-ChildItem -Path $dest -Recurse -Filter 'ngrok.exe' | Select-Object -First 1
  if (-not $exe) { Write-Error 'ngrok.exe not found inside zip'; exit 3 }

  Write-Host "Found ngrok.exe at $($exe.FullName). Checking version..."
  $verOut = & $exe.FullName version 2>&1
  Write-Host $verOut
  if ($verOut -match '\d+\.\d+\.\d+') { $ver = $Matches[0] } else { $ver = $verOut }
  Write-Host "Detected ngrok version: $ver"

  # require version >= 3.20.0 or version starting with 3.
  if (-not ($ver -match '^3\.' -or [version]$ver -ge [version]'3.20.0')) {
    Write-Warning "Downloaded binary does not appear to be ngrok v3 (or >=3.20.0). It may still work but proceed with caution."
  }

  # Target path
  $targetDir = Join-Path $root 'node_modules\ngrok\bin'
  if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
  $targetExe = Join-Path $targetDir 'ngrok.exe'
  if (Test-Path $targetExe) { Copy-Item $targetExe "$targetExe.bak_$(Get-Date -Format yyyyMMddHHmmss)" -Force }
  Copy-Item $exe.FullName $targetExe -Force
  Write-Host "Replaced project ngrok binary at $targetExe"

  # register authtoken from .env if present
  $envfile = Join-Path $root '.env'
  $token = $null
  if (Test-Path $envfile) {
    $lines = Get-Content $envfile
    foreach ($l in $lines) {
      if ($l -match '^NGROK_AUTHTOKEN\s*=\s*(.+)$') { $token = $Matches[1].Trim(); break }
    }
  }
  if ($token) {
    Write-Host 'Registering authtoken with new binary...'
    & $targetExe authtoken $token | Out-Null
    Write-Host 'Authtoken registered.'
  } else {
    Write-Warning 'No NGROK_AUTHTOKEN found in .env. You should run: ngrok authtoken <token>'
  }

  # Start app and ngrok
  Write-Host 'Starting app (background)...'
  Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'app.js' -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 1

  Write-Host 'Starting ngrok: http 3002 ...'
  $ngrokProc = Start-Process -FilePath $targetExe -ArgumentList @('http','3002','--log','stdout') -WorkingDirectory $root -NoNewWindow -PassThru
  Start-Sleep -Seconds 2

  # Poll for public URL
  $publicUrl = $null
  for ($i=0; $i -lt 40; $i++) {
    try {
      $data = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -Method Get -TimeoutSec 2
      if ($data.tunnels) {
        $t = $data.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
        if (-not $t) { $t = $data.tunnels[0] }
        if ($t) { $publicUrl = $t.public_url; break }
      }
    } catch { }
    Start-Sleep -Milliseconds 500
  }

  if ($publicUrl) { Write-Host "Public URL: $publicUrl" } else { Write-Error 'ngrok started but no public URL detected. Check http://127.0.0.1:4040' ; exit 5 }

  exit 0
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
