$zip=Join-Path $env:TEMP 'ngrok_v3_try.zip'
if(Test-Path $zip){ Remove-Item $zip -Force }
try {
  Invoke-WebRequest -Uri 'https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-v3-stable-windows-amd64.zip' -OutFile $zip -UseBasicParsing -TimeoutSec 60
} catch {
  Write-Error "Download failed: $($_.Exception.Message)"
  exit 1
}
$dest=Join-Path $env:TEMP 'ngrok_v3_try'
if(Test-Path $dest){ Remove-Item $dest -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $dest -Force
$exe = Get-ChildItem -Path $dest -Recurse -Filter 'ngrok.exe' | Select-Object -First 1
if ($exe) {
  Write-Host "Found: $($exe.FullName)"
  & $exe.FullName version
} else {
  Write-Host 'ngrok.exe not found'
  exit 2
}
