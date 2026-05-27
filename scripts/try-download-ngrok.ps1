$urls = @(
  'https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-windows-amd64.zip',
  'https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-v3-stable-windows-amd64.zip',
  'https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-v3-windows-amd64.zip',
  'https://ngrok.com/download/ngrok-v3-stable-windows-amd64.zip',
  'https://ngrok.com/download/ngrok-stable-windows-amd64.zip'
)

foreach ($u in $urls) {
  Write-Host "Trying $u"
  $zip = Join-Path $env:TEMP 'ngrok_try.zip'
  if (Test-Path $zip) { Remove-Item $zip -Force }
  try {
    Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing -TimeoutSec 30
  } catch {
    Write-Host "download failed: $($_.Exception.Message)"
    continue
  }
  $dest = Join-Path $env:TEMP 'ngrok_try'
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $dest -Force
  $exe = Get-ChildItem -Path $dest -Recurse -Filter 'ngrok.exe' | Select-Object -First 1
  if ($exe) {
    Write-Host "Found ngrok.exe at $($exe.FullName)"
    & $exe.FullName version
    break
  } else {
    Write-Host "ngrok.exe not found inside zip"
  }
}
