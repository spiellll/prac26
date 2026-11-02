#!/bin/zsh
cd "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  export PATH="/Users/anastasiasolomonova/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  print 'Установи Node.js 22.13 или новее, затем запусти этот файл ещё раз.'
  read -k 1
  exit 1
fi
if [[ ! -d node_modules ]]; then
  print 'Сначала установи зависимости: npm ci. Подробности в README.md.'
  read -k 1
  exit 1
fi
if [[ ! -f data/diary.sqlite ]]; then
  print 'Файл дневника data/diary.sqlite не найден. Перенеси всю папку data вместе с проектом.'
  read -k 1
  exit 1
fi
node scripts/run-framework.mjs dev
