#!/bin/bash

[ -f .env ] && source .env
[ ! -s "`node -p 'require("./knexfile").connection'`" ] && knex migrate:latest
babel-node app.js
