@echo off
title Usar Celular no PC - caducosilva
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -LiteralPath '%~f0' -Raw) -split ('#PS'+'CODE#'),2)[1]"
echo.
pause
exit /b
#PSCODE#

# Usar Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
# Conecta no S25 Ultra ja pareado e abre o espelhamento (scrcpy).

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "Usar Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com" -ForegroundColor Cyan
Write-Host "doacoes via PIX: f74458dc-2a36-49bd-9250-1cef4365ebb8" -ForegroundColor DarkGray
Write-Host ""

# --- acha um adb que funcione ------------------------------------
# o adb que vem dentro da pasta do scrcpy costuma dar
# "CreateProcessW() error 5", por isso fica por ultimo
$adb = @(
  "$env:USERPROFILE\Android\Sdk\platform-tools\adb.exe",
  "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe",
  "$env:USERPROFILE\platform-tools\adb.exe",
  "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.0\adb.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$scrcpy = @(
  "$env:ProgramFiles\scrcpy\scrcpy.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $scrcpy) {
  $wingetScrcpy = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe'
  if (Test-Path $wingetScrcpy) {
    $scrcpy = Get-ChildItem -Path $wingetScrcpy -Filter scrcpy.exe -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
}

if (-not $adb) {
  Write-Host "ERRO: nao achei nenhum adb.exe instalado." -ForegroundColor Red
  Write-Host "Instala com:  winget install Google.PlatformTools"
  return
}
if (-not $scrcpy) {
  Write-Host "ERRO: nao achei o scrcpy.exe." -ForegroundColor Red
  Write-Host "Instala com:  winget install Genymobile.scrcpy"
  return
}

# o scrcpy le essa variavel. Sem ela ele usa o adb da propria pasta
# e morre com "CreateProcessW() error 5 / Could not start adb server".
$env:ADB = $adb
Write-Host "adb: $adb" -ForegroundColor DarkGray

function Get-Serial {
  # Prefere USB (serial sem ip:porta / mDNS); Wi-Fi so se nao houver cabo
  $usb = $null
  $wifi = $null
  foreach ($linha in (& $adb devices 2>$null)) {
    $p = $linha -split "\s+"
    if ($p.Count -lt 2 -or $p[1] -ne "device") { continue }
    $s = $p[0]
    if ($s -match ':\d+$' -or $s -match '_adb-tls-') {
      if (-not $wifi) { $wifi = $s }
    } else {
      if (-not $usb) { $usb = $s }
    }
  }
  if ($usb) { return $usb }
  return $wifi
}

& $adb start-server 2>&1 | Out-Null

# --- conecta -------------------------------------------------------
$serial = Get-Serial
if (-not $serial) {
  Write-Host "Procurando o celular na rede..." -ForegroundColor DarkGray
  for ($i = 0; $i -lt 8; $i++) {
    $linha = (& $adb mdns services 2>$null) | Where-Object { $_ -match "_adb-tls-connect" } | Select-Object -First 1
    if ($linha) {
      $ep = ($linha -split "\s+") | Where-Object { $_ -match "^\d+\.\d+\.\d+\.\d+:\d+$" } | Select-Object -First 1
      if ($ep) { & $adb connect $ep 2>&1 | Out-Null }
    }
    $serial = Get-Serial
    if ($serial) { break }
    Start-Sleep -Seconds 2
  }
}

if (-not $serial) {
  Write-Host ""
  Write-Host "Nao achei o celular." -ForegroundColor Red
  Write-Host "Checklist:"
  Write-Host "  - Depuracao sem fio LIGADA no celular"
  Write-Host "  - PC e celular na MESMA rede Wi-Fi"
  Write-Host "  - Se nunca pareou nesse PC (ou trocou de rede), roda o arquivo"
  Write-Host "    '1 - Parear Celular.bat' primeiro."
  return
}

Write-Host "Conectado: $serial" -ForegroundColor Green
Write-Host "Abrindo resolucao nativa do celular... (feche a janela pra encerrar)" -ForegroundColor Green
Write-Host ""

# Sem crop / max-size / fps / bitrate: o aparelho define a qualidade.
$scrcpyArgs = @(
  '-s', $serial,
  '--window-title', 'Celular no PC - caducosilva',
  '--stay-awake'
)

& $scrcpy @scrcpyArgs
