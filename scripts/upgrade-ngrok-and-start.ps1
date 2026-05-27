try {
  $root = Split-Path -Parent $PSScriptRoot
  Write-Host "Working in: $root"
  $downloadPage = Invoke-WebRequest -UseBasicParsing 'https://ngrok.com/download'
  $link = $downloadPage.Links | Where-Object { $_.href -and ($_.href -match 'windows-amd64') } | Select-Object -First 1
  if (-not $link) { Write-Error 'No windows-amd64 link found on ngrok download page'; exit 1 }
  $url = $link.href
  Write-Host "Found download URL: $url"
  $zip = Join-Path $env:TEMP 'ngrok_v3.zip'
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Write-Host "Downloading to $zip ..."
  Invoke-WebRequest -Uri $url -OutFile $zip
  $destDir = Join-Path $env:TEMP 'ngrok_v3_unzip'
  if (Test-Path $destDir) { Remove-Item $destDir -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $destDir -Force
  $exe = Get-ChildItem -Path $destDir -Recurse -Filter 'ngrok.exe' | Select-Object -First 1
  if (-not $exe) { Write-Error 'ngrok.exe not found inside zip'; exit 1 }
  $targetDir = Join-Path $root 'node_modules\ngrok\bin'
  if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
  $target = Join-Path $targetDir 'ngrok.exe'
  if (Test-Path $target) { Copy-Item $target "$target.bak" -Force }
  Copy-Item $exe.FullName $target -Force
  Write-Host "Replaced ngrok binary at $target"

  # register authtoken if present in .env
  $envfile = Join-Path $root '.env'
  if (Test-Path $envfile) {
    $tokenLine = Select-String -Path $envfile -Pattern '^NGROK_AUTHTOKEN=' -SimpleMatch | Select-Object -First 1
    if ($tokenLine) {
      $token = ($tokenLine.Line -split '=')[1].Trim()
      if ($token) {
        Write-Host 'Registering authtoken with new binary...'
        & $target authtoken $token | Out-Null
        Write-Host 'Authtoken registered.'
      }
    }
  }

  Write-Host 'Starting tunnel launcher script...'
  & 'C:\Program Files\nodejs\node.exe' scripts\start-with-ngrok.js
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
