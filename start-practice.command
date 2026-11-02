#!/bin/zsh
cd "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  print 'Нужен Node.js 22.13+. Открой README.md.'
  exit 1
fi
node scripts/run-practice.mjs start
