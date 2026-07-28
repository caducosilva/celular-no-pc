#!/usr/bin/env bash
# ------------------------------------------------------------------
# Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
# Conecta e abre o espelhamento sem abrir o painel.
# Argumentos extras vao direto pro scrcpy, ex: ./2*.sh --turn-screen-off
# ------------------------------------------------------------------
set -u
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: o Node.js nao esta instalado.  sudo apt install nodejs"
  [ -t 0 ] && read -r -n 1 -p "Pressione qualquer tecla pra fechar..."
  exit 1
fi

node "$AQUI/espelhar.mjs" "$@"
CODIGO=$?

if [ $CODIGO -ne 0 ] && [ -t 0 ]; then
  echo ""
  read -r -n 1 -p "Pressione qualquer tecla pra fechar..."
  echo ""
fi
exit $CODIGO
