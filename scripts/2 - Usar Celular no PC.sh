#!/usr/bin/env bash
# ------------------------------------------------------------------
# Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
#
# Conecta no celular ja pareado e abre o espelhamento (scrcpy).
# Funciona via USB ou via WiFi (depuracao sem fio).
# ------------------------------------------------------------------
set -u

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ciano='\033[36m'; verde='\033[32m'; amarelo='\033[33m'; vermelho='\033[31m'; fraco='\033[90m'; normal='\033[0m'

echo ""
echo -e "${ciano}Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com${normal}"
echo ""

tem() { command -v "$1" >/dev/null 2>&1; }

# --- adb ----------------------------------------------------------
if tem adb; then
  ADB="adb"
elif [ -x "$HOME/Android/Sdk/platform-tools/adb" ]; then
  ADB="$HOME/Android/Sdk/platform-tools/adb"
else
  echo -e "${vermelho}ERRO: nao achei o adb.${normal}"
  echo "  Instale com:  sudo apt install android-tools-adb"
  exit 1
fi

# --- scrcpy -------------------------------------------------------
if tem scrcpy; then
  SCRCPY="scrcpy"
else
  echo -e "${vermelho}ERRO: nao achei o scrcpy.${normal}"
  echo "  Instale com:  sudo apt install scrcpy"
  exit 1
fi

echo -e "${fraco}adb: $ADB${normal}"
echo -e "${fraco}scrcpy: $SCRCPY${normal}"
echo ""

"$ADB" start-server 2>/dev/null

# --- conecta -------------------------------------------------------
SERIAL=$("$ADB" devices 2>/dev/null | grep -v '^List' | awk '$2 == "device" {print $1; exit}')

if [ -z "$SERIAL" ]; then
  echo -e "${amarelo}Procurando o celular na rede (WiFi)...${normal}"
  for i in $(seq 1 8); do
    LINA=$("$ADB" mdns services 2>/dev/null | grep "_adb-tls-connect")
    if [ -n "$LINA" ]; then
      EP=$(echo "$LINA" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+' | head -1)
      if [ -n "$EP" ]; then
        "$ADB" connect "$EP" 2>/dev/null
      fi
    fi
    SERIAL=$("$ADB" devices 2>/dev/null | grep -v '^List' | awk '$2 == "device" {print $1; exit}')
    if [ -n "$SERIAL" ]; then break; fi
    sleep 2
  done
fi

if [ -z "$SERIAL" ]; then
  echo ""
  echo -e "${vermelho}Nao achei o celular.${normal}"
  echo "  Checklist:"
  echo "    - Depuracao sem fio LIGADA no celular"
  echo "    - PC e celular na MESMA rede Wi-Fi"
  echo "    - Se nunca pareou nesse PC (ou trocou de rede), roda o arquivo"
  echo "      '1 - Parear Celular.sh' primeiro."
  echo ""
  echo "  Ou conecte via USB e tente de novo."
  exit 1
fi

echo -e "${verde}Conectado: $SERIAL${normal}"
echo -e "${verde}Abrindo espelhamento... (feche a janela pra encerrar)${normal}"
echo ""

"$SCRCPY" -s "$SERIAL" --window-title "Android - caducosilva"
