#!/bin/bash
[ -f .env ] && source .env
babel-node app.js
