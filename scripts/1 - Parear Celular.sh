#!/usr/bin/env bash
# ------------------------------------------------------------------
# Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
#
# Pareia o celular por QR code (Depuracao sem fio).
# Abre o QR no visualizador de imagens e faz o pareamento sozinho.
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

echo -e "${fraco}adb: $ADB$(normal)"
"$ADB" start-server 2>/dev/null

# --- ja conectado? -----------------------------------------------
SERIAL=$("$ADB" devices 2>/dev/null | grep -v '^List' | awk '$2 == "device" {print $1; exit}')
if [ -n "$SERIAL" ]; then
  echo ""
  echo -e "${verde}O celular JA esta pareado e conectado: $SERIAL${normal}"
  echo "  Nao precisa parear de novo. Abre o arquivo 2 pra usar o celular no PC."
  exit 0
fi

# --- gera o QR code ----------------------------------------------
if ! tem python3; then
  echo -e "${vermelho}ERRO: precisa do python3 instalado pra gerar o QR code.${normal}"
  exit 1
fi

python3 -c "import qrcode" 2>/dev/null
if [ $? -ne 0 ]; then
  echo -e "${amarelo}Instalando a lib do qrcode (so na primeira vez)...${normal}"
  pip3 install --quiet "qrcode[pil]" 2>/dev/null || pip install --quiet "qrcode[pil]" 2>/dev/null
fi

ALFABETO="abcdefghijkmnpqrstuvwxyz23456789"
NOME_QR="ADB_caducosilva_$(tr -dc "$ALFABETO" < /dev/urandom | head -c 6)"
SENHA_QR="$(tr -dc "$ALFABETO" < /dev/urandom | head -c 12)"
PNG_QR="/tmp/adb-pair-qr.png"

python3 -c "
import qrcode, sys
qrcode.make(sys.argv[1], box_size=10, border=4).save(sys.argv[2])
" "WIFI:T:ADB;S:${NOME_QR};P:${SENHA_QR};;" "$PNG_QR"

if [ ! -f "$PNG_QR" ]; then
  echo -e "${vermelho}ERRO: nao consegui gerar o QR code.${normal}"
  exit 1
fi

echo ""
echo -e "${amarelo}No celular abra:${normal}"
echo -e "  Config > Opcoes do desenvolvedor > Depuracao sem fio"
echo -e "  > Parear dispositivo com codigo QR"
echo ""
echo -e "${amarelo}Escaneia o QR que abriu na tela. Pareia sozinho.${normal}"
echo -e "${fraco}(3 minutos de espera)${normal}"
echo ""

xdg-open "$PNG_QR" 2>/dev/null || view "$PNG_QR" 2>/dev/null || cat "$PNG_QR" 2>/dev/null

PAREOU=false
for i in $(seq 1 90); do
  LINHA=$("$ADB" mdns services 2>/dev/null | grep "$NOME_QR" | grep "_adb-tls-pairing")
  if [ -n "$LINHA" ]; then
    EP=$(echo "$LINHA" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+' | head -1)
    if [ -n "$EP" ]; then
      echo -e "${fraco}QR lido pelo celular ($EP). Pareando...${normal}"
      RESULTADO=$("$ADB" pair "$EP" "$SENHA_QR" 2>&1)
      echo "$RESULTADO"
      if echo "$RESULTADO" | grep -q "Successfully paired"; then
        PAREOU=true
        break
      fi
    fi
  fi
  sleep 2
done

rm -f "$PNG_QR"

if [ "$PAREOU" = false ]; then
  echo ""
  echo -e "${vermelho}Nao pareou dentro do tempo.${normal}"
  echo "  Checklist:"
  echo "    - PC e celular na MESMA rede Wi-Fi"
  echo "    - Depuracao sem fio LIGADA no celular"
  echo "    - Isolamento de clientes / AP isolation desligado no roteador"
  exit 1
fi

# --- conecta -----------------------------------------------------
echo ""
echo -e "${fraco}Conectando...${normal}"
for i in $(seq 1 15); do
  LINHA=$("$ADB" mdns services 2>/dev/null | grep "_adb-tls-connect")
  if [ -n "$LINHA" ]; then
    EP=$(echo "$LINHA" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+' | head -1)
    if [ -n "$EP" ]; then
      "$ADB" connect "$EP" 2>/dev/null
    fi
  fi
  SERIAL=$("$ADB" devices 2>/dev/null | grep -v '^List' | awk '$2 == "device" {print $1; exit}')
  if [ -n "$SERIAL" ]; then break; fi
  sleep 2
done

"$ADB" devices -l
echo ""

if [ -n "$SERIAL" ]; then
  echo -e "${verde}PRONTO! Celular pareado e conectado: $SERIAL${normal}"
  echo "  Agora abre o arquivo 2 pra usar o celular no PC."
else
  echo -e "${vermelho}Pareou mas nao conectou. Roda esse arquivo de novo.${normal}"
fi
echo ""
