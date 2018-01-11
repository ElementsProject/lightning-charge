#!/bin/bash
[ -f .env ] && source .env

if [ -f src/app.js ]; then
  babel-node src/app.js
else
  node dist/app.js
fi
