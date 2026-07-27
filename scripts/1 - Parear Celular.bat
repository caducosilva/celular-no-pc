@echo off
title Parear Celular - caducosilva
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -LiteralPath '%~f0' -Raw) -split ('#PS'+'CODE#'),2)[1]"
echo.
pause
exit /b
#PSCODE#

# Parear Celular . criado por caducosilva . contato: abobicarlo@gmail.com
# Pareia o S25 Ultra por QR code (Depuracao sem fio).

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "Parear Celular . criado por caducosilva . contato: abobicarlo@gmail.com" -ForegroundColor Cyan
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

if (-not $adb) {
  Write-Host "ERRO: nao achei nenhum adb.exe instalado." -ForegroundColor Red
  Write-Host "Instala com:  winget install Google.PlatformTools"
  return
}
$env:ADB = $adb
Write-Host "adb: $adb" -ForegroundColor DarkGray

function Get-Serial {
  foreach ($linha in (& $adb devices 2>$null)) {
    $p = $linha -split "\s+"
    if ($p.Count -ge 2 -and $p[1] -eq "device") { return $p[0] }
  }
  return $null
}

& $adb start-server 2>&1 | Out-Null

# --- ja esta conectado? -------------------------------------------
$serial = Get-Serial
if ($serial) {
  Write-Host ""
  Write-Host "O celular JA esta pareado e conectado: $serial" -ForegroundColor Green
  Write-Host "Nao precisa parear de novo. Abre o arquivo 2 pra usar o celular no PC."
  return
}

# --- gera o QR code -----------------------------------------------
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) {
  Write-Host "ERRO: precisa do Python instalado pra gerar o QR code." -ForegroundColor Red
  return
}
& $python -c "import qrcode" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Instalando a lib do QR code (so na primeira vez)..." -ForegroundColor DarkGray
  & $python -m pip install --quiet "qrcode[pil]" 2>&1 | Out-Null
}

$alfabeto = [char[]]"abcdefghijkmnpqrstuvwxyz23456789"
$nomeQr  = "ADB_caducosilva_" + (-join ((1..6)  | ForEach-Object { Get-Random -InputObject $alfabeto }))
$senhaQr =                      -join ((1..12) | ForEach-Object { Get-Random -InputObject $alfabeto })
$pngQr   = Join-Path $env:TEMP "adb-pair-qr.png"

& $python -c "import qrcode,sys; qrcode.make(sys.argv[1], box_size=10, border=4).save(sys.argv[2])" "WIFI:T:ADB;S:$nomeQr;P:$senhaQr;;" $pngQr
if (-not (Test-Path $pngQr)) {
  Write-Host "ERRO: nao consegui gerar o QR code." -ForegroundColor Red
  return
}

Write-Host ""
Write-Host "No celular abra:" -ForegroundColor Yellow
Write-Host "  Config > Opcoes do desenvolvedor > Depuracao sem fio"
Write-Host "  > Parear dispositivo com codigo QR"
Write-Host ""
Write-Host "Escaneia o QR que abriu na tela. Eu pareio sozinho." -ForegroundColor Yellow
Write-Host "(3 minutos de espera)" -ForegroundColor DarkGray
Write-Host ""

$visualizador = Start-Process -FilePath $pngQr -PassThru -ErrorAction SilentlyContinue

$pareou = $false
for ($i = 0; $i -lt 90; $i++) {
  $linha = (& $adb mdns services 2>$null) |
           Where-Object { $_ -match [regex]::Escape($nomeQr) -and $_ -match "_adb-tls-pairing" } |
           Select-Object -First 1
  if ($linha) {
    $ep = ($linha -split "\s+") | Where-Object { $_ -match "^\d+\.\d+\.\d+\.\d+:\d+$" } | Select-Object -First 1
    Write-Host "QR lido pelo celular ($ep). Pareando..." -ForegroundColor DarkGray
    $r = (& $adb pair $ep $senhaQr 2>&1) -join "`n"
    Write-Host $r
    if ($r -match "Successfully paired") { $pareou = $true; break }
  }
  Start-Sleep -Seconds 2
}

if ($visualizador) { Stop-Process -Id $visualizador.Id -ErrorAction SilentlyContinue }
Remove-Item $pngQr -ErrorAction SilentlyContinue

if (-not $pareou) {
  Write-Host ""
  Write-Host "Nao pareou dentro do tempo." -ForegroundColor Red
  Write-Host "Checklist:"
  Write-Host "  - PC e celular na MESMA rede Wi-Fi (rede de convidado nao funciona)"
  Write-Host "  - Depuracao sem fio LIGADA no celular"
  Write-Host "  - Isolamento de clientes / AP isolation desligado no roteador"
  return
}

# --- conecta (a porta de conexao e diferente da de pareamento) -----
Write-Host ""
Write-Host "Conectando..." -ForegroundColor DarkGray
for ($i = 0; $i -lt 15; $i++) {
  $linha = (& $adb mdns services 2>$null) | Where-Object { $_ -match "_adb-tls-connect" } | Select-Object -First 1
  if ($linha) {
    $ep = ($linha -split "\s+") | Where-Object { $_ -match "^\d+\.\d+\.\d+\.\d+:\d+$" } | Select-Object -First 1
    if ($ep) { & $adb connect $ep 2>&1 | Out-Null }
  }
  $serial = Get-Serial
  if ($serial) { break }
  Start-Sleep -Seconds 2
}

& $adb devices -l
Write-Host ""
if ($serial) {
  Write-Host "PRONTO! Celular pareado e conectado." -ForegroundColor Green
  Write-Host "Agora abre o arquivo 2 pra usar o celular no PC."
} else {
  Write-Host "Pareou mas nao conectou. Roda esse arquivo de novo." -ForegroundColor Red
}
