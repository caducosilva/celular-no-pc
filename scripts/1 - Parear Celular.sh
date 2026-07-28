#!/usr/bin/env bash
# ------------------------------------------------------------------
# Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
# Pareia por QR code sem abrir o painel. Dois cliques > "Executar no terminal".
# ------------------------------------------------------------------
set -u
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: o Node.js nao esta instalado.  sudo apt install nodejs"
  [ -t 0 ] && read -r -n 1 -p "Pressione qualquer tecla pra fechar..."
  exit 1
fi

node "$AQUI/parear.mjs"
CODIGO=$?

# Aberto com dois cliques a janela sumiria junto com o resultado.
if [ -t 0 ]; then
  echo ""
  read -r -n 1 -p "Pressione qualquer tecla pra fechar..."
  echo ""
fi
exit $CODIGO
