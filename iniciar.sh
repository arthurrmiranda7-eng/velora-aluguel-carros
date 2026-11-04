#!/usr/bin/env bash
set -e
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Instale o Node.js 20 ou superior: https://nodejs.org'
  exit 1
fi
if [ ! -f node_modules/json-server/package.json ]; then
  echo 'Instalando dependências. Aguarde…'
  npm ci
fi
echo 'Abra http://localhost:3000 no navegador. Ctrl+C encerra o servidor.'
npm start
