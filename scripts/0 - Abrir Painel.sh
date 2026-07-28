#!/usr/bin/env bash
# ------------------------------------------------------------------
# Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
#
# Launcher do Linux (e macOS). Dois cliques > "Executar no terminal".
# Confere o que falta, sobe o painel numa porta livre e abre o navegador.
# Fechar esta janela desliga o painel e libera a porta.
# ------------------------------------------------------------------
set -u

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$AQUI")"

ciano='\033[36m'; verde='\033[32m'; amarelo='\033[33m'; vermelho='\033[31m'
fraco='\033[90m'; normal='\033[0m'

echo ""
echo -e "${ciano}Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com${normal}"
echo -e "${fraco}doacoes via PIX: f74458dc-2a36-49bd-9250-1cef4365ebb8${normal}"
echo ""

# Quando aberto com dois cliques, a janela some junto com o erro. Este
# trap segura ela aberta pra dar tempo de ler o que deu errado.
segurar_janela() {
  if [ -t 0 ]; then
    echo ""
    read -r -n 1 -p "Pressione qualquer tecla pra fechar..."
    echo ""
  fi
}

erro_e_sai() {
  echo ""
  echo -e "${vermelho}$1${normal}"
  shift
  for linha in "$@"; do echo "$linha"; done
  segurar_janela
  exit 1
}

tem() { command -v "$1" >/dev/null 2>&1; }

# --- gerenciador de pacotes, so pra dar a dica certa ----------------
if   tem apt;    then INSTALAR="sudo apt install -y"
elif tem dnf;    then INSTALAR="sudo dnf install -y"
elif tem pacman; then INSTALAR="sudo pacman -S --noconfirm"
elif tem zypper; then INSTALAR="sudo zypper install -y"
elif tem brew;   then INSTALAR="brew install"
else                  INSTALAR=""
fi

dica() {
  local pacote="$1"
  if [ -n "$INSTALAR" ]; then
    echo "  Instale com:  $INSTALAR $pacote"
  else
    echo "  Instale o pacote '$pacote' pelo gerenciador da sua distro."
  fi
}

# --- Node.js (obrigatorio) ------------------------------------------
if ! tem node; then
  erro_e_sai "ERRO: o Node.js nao esta instalado." "$(dica nodejs)" \
    "  Ou use o nvm: https://github.com/nvm-sh/nvm"
fi
echo -e "${fraco}node: $(node -v)${normal}"

# --- adb (obrigatorio pro painel funcionar) -------------------------
if tem adb; then
  echo -e "${fraco}adb: ok${normal}"
elif [ -x "$HOME/Android/Sdk/platform-tools/adb" ]; then
  echo -e "${fraco}adb: ok (Android SDK)${normal}"
else
  echo -e "${amarelo}AVISO: nao achei o adb.${normal}"
  dica android-tools-adb
  echo ""
fi

# --- scrcpy (so pro espelhamento) -----------------------------------
if tem scrcpy; then
  echo -e "${fraco}scrcpy: ok${normal}"
else
  echo -e "${amarelo}AVISO: nao achei o scrcpy. Da pra parear, mas nao espelhar.${normal}"
  dica scrcpy
  echo ""
fi

# --- entrega pro nucleo comum ---------------------------------------
# exec: o node vira ESTE processo, entao fechar a janela manda o sinal
# direto pra ele, que derruba o painel e libera a porta.
cd "$RAIZ" || erro_e_sai "ERRO: nao consegui entrar em $RAIZ"
exec node "$AQUI/painel.mjs"
