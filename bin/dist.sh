#!/bin/bash
set -eo pipefail

rm -rf dist

mkdir dist
babel -d dist src

mkdir dist/www
cp www/bootstrap.min.css dist/www
stylus -o dist/www www
babel www/checkout.js | uglifyjs -cm > dist/www/checkout.js
