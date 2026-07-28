@echo off
title Celular no PC - caducosilva
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -LiteralPath '%~f0' -Raw) -split ('#PS'+'CODE#'),2)[1]"
echo.
pause
exit /b
#PSCODE#

# Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
# Instala o que estiver faltando, sobe o painel e abre no navegador.
# Feito pra funcionar com dois cliques, sem terminal.

$ErrorActionPreference = "Continue"

function Atualizar-Path {
  $maquina = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $usuario = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = @($maquina, $usuario) -join ";"
}

function Tem-Comando([string]$nome) {
  return [bool](Get-Command $nome -ErrorAction SilentlyContinue)
}

function Instalar-Winget([string]$id, [string]$rotulo) {
  Write-Host "Instalando $rotulo..." -ForegroundColor Yellow
  Write-Host "(pode aparecer uma janela pedindo permissao do Windows)" -ForegroundColor DarkGray
  winget install --id $id --accept-source-agreements --accept-package-agreements --silent
  Atualizar-Path
}

Write-Host ""
Write-Host "Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com" -ForegroundColor Cyan
Write-Host "doacoes via PIX: f74458dc-2a36-49bd-9250-1cef4365ebb8" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Vou checar o que falta, instalar se precisar, e abrir o painel." -ForegroundColor White
Write-Host "Na primeira vez isso pode demorar alguns minutos. Depois e instantaneo." -ForegroundColor DarkGray
Write-Host ""

# ---------------------------------------------------------------
# 1. Onde esta o projeto
# ---------------------------------------------------------------
$candidatos = @(
  (Join-Path $PSScriptRoot ".."),
  (Join-Path $env:USERPROFILE "dev\celular-no-pc"),
  (Join-Path $env:USERPROFILE "celular-no-pc"),
  (Join-Path $env:USERPROFILE "Downloads\celular-no-pc")
)
$projeto = $candidatos |
  Where-Object { $_ -and (Test-Path (Join-Path $_ "package.json")) } |
  Select-Object -First 1

if (-not $projeto) {
  Write-Host "ERRO: nao achei a pasta do projeto." -ForegroundColor Red
  Write-Host ""
  Write-Host "Baixe o projeto em:" -ForegroundColor Yellow
  Write-Host "  https://github.com/caducosilva/celular-no-pc"
  Write-Host "Clique em Code > Download ZIP, extraia, e deixe este arquivo"
  Write-Host "dentro da pasta 'scripts' do projeto."
  return
}
$projeto = (Resolve-Path $projeto).Path
Write-Host "projeto: $projeto" -ForegroundColor DarkGray

# ---------------------------------------------------------------
# 2. Pre-requisitos
# ---------------------------------------------------------------
Atualizar-Path

if (-not (Tem-Comando "winget")) {
  Write-Host "ERRO: o winget nao esta disponivel neste Windows." -ForegroundColor Red
  Write-Host "Instale o 'Instalador de Aplicativo' pela Microsoft Store e rode de novo."
  return
}

# adb (Platform Tools)
$temAdb = @(
  "$env:USERPROFILE\Android\Sdk\platform-tools\adb.exe",
  "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe",
  "$env:USERPROFILE\platform-tools\adb.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $temAdb -and -not (Tem-Comando "adb")) {
  Instalar-Winget "Google.PlatformTools" "as Platform Tools do Android (adb)"
} else {
  Write-Host "adb: ok" -ForegroundColor DarkGray
}

# scrcpy
$temScrcpy = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe" -Filter "scrcpy.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $temScrcpy -and -not (Tem-Comando "scrcpy")) {
  Instalar-Winget "Genymobile.scrcpy" "o scrcpy (espelhamento)"
} else {
  Write-Host "scrcpy: ok" -ForegroundColor DarkGray
}

# Node.js
if (-not (Tem-Comando "npm")) {
  Instalar-Winget "OpenJS.NodeJS.LTS" "o Node.js"
} else {
  Write-Host "node: ok" -ForegroundColor DarkGray
}

Atualizar-Path

if (-not (Tem-Comando "npm")) {
  Write-Host ""
  Write-Host "Instalei o que faltava, mas o Windows so reconhece os programas novos" -ForegroundColor Yellow
  Write-Host "depois que esta janela e fechada." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Feche esta janela e abra este arquivo de novo (dois cliques)." -ForegroundColor Yellow
  return
}


# ---------------------------------------------------------------
# 3. Entrega pro nucleo comum (o mesmo usado no Linux)
# ---------------------------------------------------------------
# O painel.mjs cuida do resto: npm install, porta livre, navegador e
# limpeza. Rodamos ele em PRIMEIRO PLANO nesta janela de proposito:
# assim, fechar a janela derruba o painel e libera a porta. Antes o
# servidor subia numa janela separada e ficava rodando sozinho.
Set-Location $projeto

Write-Host ""
& node (Join-Path $PSScriptRoot "painel.mjs")
